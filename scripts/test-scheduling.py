#!/usr/bin/env python3
"""Run scheduling migrations and race/isolation tests on disposable PostgreSQL.

No environment credentials, remote database, purchases or application data used.
Requires the project's PostgreSQL runtime (initdb, pg_ctl, psql).
"""
import concurrent.futures
import json
from pathlib import Path
import re
import subprocess
import tempfile
import uuid
from scheduling_override_tests import run_override_tests
from scheduling_resource_tests import run_resource_tests
from scheduling_friend_rental_tests import run_friend_rental_tests
from scheduling_camp_tests import run_camp_tests
from scheduling_waitlist_tests import run_waitlist_tests

ROOT = Path(__file__).resolve().parents[1]
TENANT = '10000000-0000-0000-0000-000000000001'
LOCATION = '20000000-0000-0000-0000-000000000001'
KID = '40000000-0000-0000-0000-000000000001'
TYPE = '60000000-0000-0000-0000-000000000001'
COACH = '50000000-0000-0000-0000-000000000001'
USER = '90000000-0000-0000-0000-000000000001'


def main():
    with tempfile.TemporaryDirectory(prefix='scheduling-test-') as directory:
        cluster = Path(directory) / 'db'
        subprocess.run(['initdb', '-D', str(cluster), '-U', 'postgres', '-A', 'trust', '--no-locale'], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['pg_ctl', '-D', str(cluster), '-l', str(Path(directory)/'postgres.log'),
                        '-o', f"-k {directory} -c listen_addresses='' -p 15438", 'start'], check=True, stdout=subprocess.DEVNULL)
        try:
            def sql(text, role='owner', user=USER, tenant=TENANT, fail=None, jwt_role='authenticated'):
                claims = json.dumps({'sub': user, 'tenant_id': tenant, 'app_role': role, 'role': jwt_role})
                query = f"SET request.jwt.claims='{claims}';\n" + text
                result = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', directory,
                                         '-p', '15438', '-d', 'postgres'], input=query, text=True, capture_output=True)
                if fail:
                    assert result.returncode != 0 and fail in result.stderr, (fail, result.stdout, result.stderr)
                else:
                    assert result.returncode == 0, result.stderr
                return result.stdout.strip()

            sql((ROOT/'scripts/fixtures/scheduling.sql').read_text())
            waitlist_source = (ROOT/'supabase/migrations/20260603000000_booking_waitlist.sql').read_text()
            sql(re.search(r'CREATE TABLE public.booking_waitlist \(.*?\n\);', waitlist_source, re.S).group())
            # Use the existing production credit function rather than a fake.
            credit_source = (ROOT/'supabase/migrations/20260616000004_eft_weekly_credits.sql').read_text()
            deduction = re.search(r'CREATE OR REPLACE FUNCTION public.deduct_session_credit\(.*?\$\$;', credit_source, re.S).group()
            sql(deduction)
            check = re.search(r'CREATE OR REPLACE FUNCTION public.check_session_credits\(.*?\$\$;', credit_source, re.S).group()
            sql(check)
            sql((ROOT/'supabase/migrations/20260603000013_harden_create_public_booking.sql').read_text())
            cancel_source = (ROOT/'supabase/migrations/20260602000004_cancellation_policy.sql').read_text()
            sql(re.search(r'CREATE OR REPLACE FUNCTION public.cancel_booking\(.*?\$\$;', cancel_source, re.S).group())
            friend_source = (ROOT/'supabase/migrations/20260617000000_fix_baf_points_ledger_balance_after.sql').read_text()
            sql(re.search(r'CREATE OR REPLACE FUNCTION public.book_session_with_friend\(.*?\$\$;', friend_source, re.S).group())
            for migration in ['20261120000010_scheduling_integrity.sql', '20261120000011_actual_instructors.sql',
                              '20261120000012_customer_booking_contract.sql', '20261120000013_scope_booking_cancellation.sql',
                              '20261120000014_friend_booking_retries.sql', '20261120000015_manual_location_capacity.sql',
                              '20261120000016_staff_walkins.sql', '20261120000017_instructor_correction_permissions.sql',
                              '20261120000018_recurring_booking_series.sql',
                              '20261120000019_dated_capacity_guards.sql', '20261120000020_dated_capacity_actions.sql',
                              '20261120000021_location_resources.sql', '20261120000022_customer_rental_resources.sql',
                              '20261120000023_camp_event_drafts.sql', '20261120000024_camp_roster_fulfillment.sql',
                              '20261120000025_camp_guards_and_checkin.sql', '20261120000026_booking_write_cutover.sql',
                              '20261120000027_waitlist_booking_contract.sql',
                              '20261120000028_publish_booking_roster_changes.sql',
                              '20261120000029_preserve_attendance_points_undo.sql',
                              '20261120000030_friend_rental_resources.sql']:
                sql((ROOT/'supabase/migrations'/migration).read_text())
            assert sql("SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='bookings';") == '1'

            def create(start='2099-01-01T10:00:00Z', end='2099-01-01T11:00:00Z',
                       key=None, coach='NULL', cage='NULL', **kwargs):
                key = key or str(uuid.uuid4())
                return sql(f"SELECT public.create_staff_booking('{KID}','{LOCATION}','{TYPE}','{start}','{end}',"
                           f"{coach},{cage},NULL,'{key}')->>'id';", **kwargs)

            def walkin(key=None, cage='NULL', session_type=TYPE, **kwargs):
                key = key or str(uuid.uuid4())
                return sql(f"SELECT public.create_staff_walkin('{KID}','{LOCATION}','{session_type}',"
                           f"{cage},NULL,'{key}')->>'id';", **kwargs)

            create(fail='capacity_policy_required')
            walkin(fail='capacity_policy_required')
            configure = f"SELECT set_manual_location_capacity('{LOCATION}',1,1);"
            for denied_role in ['parent', 'admin', 'coach']:
                sql("SET ROLE authenticated; " + configure, role=denied_role, fail='PERMISSION_DENIED')
            sql("SET ROLE authenticated; " + configure,
                tenant='10000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
            sql(f"SELECT set_manual_location_capacity('{LOCATION}',0,1);", fail='positive_capacity_required')
            sql(f"SELECT set_manual_location_capacity('{LOCATION}',NULL,1);", fail='positive_capacity_required')
            sql("SET ROLE authenticated; " + configure)
            assert sql("SELECT count(*) FROM scheduling_capacity_history;") == '1'
            assert sql("SELECT has_table_privilege('authenticated','scheduling_capacity_history','UPDATE');") == 'f'
            walkin(role='parent', fail='PERMISSION_DENIED')
            walkin(role='coach', user='90000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
            walkin(role='admin', user='90000000-0000-0000-0000-000000000003', fail='PERMISSION_DENIED')
            walkin(tenant='10000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
            key = str(uuid.uuid4())
            first_walkin = walkin(key=key)
            assert first_walkin == walkin(key=key)
            assert sql(f"SELECT scheduled_start BETWEEN now()-interval '1 minute' AND now()+interval '1 second'"
                       f" AND scheduled_end-scheduled_start=interval '1 hour'"
                       f" AND status='confirmed' AND attended_at IS NULL AND actual_coach_id IS NULL"
                       f" FROM bookings WHERE id='{first_walkin}';") == 't'
            assert sql("SELECT count(*) FROM sessions;") == '0'
            assert sql(f"SELECT sessions_remaining FROM memberships WHERE kid_id='{KID}';") == '29'
            assert sql("SELECT jsonb_array_length(get_staff_checkin_roster(now()-interval '1 minute',now()+interval '1 day'));") == '1'
            create(key=key, fail='idempotency_key_reused')
            walkin(key=key, session_type='60000000-0000-0000-0000-000000000002', fail='idempotency_key_reused')
            walkin(fail='slot_not_available')
            sql(f"SELECT record_booking_attendance('{first_walkin}','noshow');")
            key = str(uuid.uuid4())
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                walkin_replays = list(pool.map(lambda _: walkin(key=key), range(2)))
            assert len(set(walkin_replays)) == 1
            sql(f"SELECT record_booking_attendance('{walkin_replays[0]}','noshow');")

            def walkin_race(_):
                try:
                    return walkin()
                except AssertionError as error:
                    assert 'slot_not_available' in str(error), str(error)
                    return None
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                walkin_winners = list(pool.map(walkin_race, range(2)))
            assert sum(winner is not None for winner in walkin_winners) == 1
            sql(f"SELECT record_booking_attendance('{next(w for w in walkin_winners if w)}','noshow');")
            sql(f"INSERT INTO scheduling_resources(tenant_id,location_id,cage_number,purpose)"
                f" VALUES('{TENANT}','{LOCATION}','walkin-fixture','instruction');")
            resource_walkin = walkin(cage="'walkin-fixture'")
            walkin(cage="'walkin-fixture'", fail='resource_not_available')
            sql(f"SELECT record_booking_attendance('{resource_walkin}','noshow');")
            sql("UPDATE memberships SET sessions_remaining=0;")
            before_walkin = sql("SELECT count(*) FROM bookings;")
            walkin(fail='no_session_credits')
            assert sql("SELECT count(*) FROM bookings;") == before_walkin
            sql("UPDATE memberships SET sessions_remaining=30;")
            key = str(uuid.uuid4())
            first = create(key=key)
            assert create(key=key) == first
            create(start='2099-01-02T10:00:00Z', end='2099-01-02T11:00:00Z', key=key, fail='idempotency_key_reused')
            assert sql(f"SELECT sessions_remaining FROM memberships WHERE kid_id='{KID}';") == '29'
            create(start='2099-01-01T10:30:00Z', end='2099-01-01T11:30:00Z', fail='slot_not_available')
            create(start='2099-01-02T10:00:00Z', end='2099-01-02T11:00:00Z', role='parent', fail='PERMISSION_DENIED')
            create(start='2099-01-02T10:00:00Z', end='2099-01-02T11:00:00Z',
                   tenant='10000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
            sql(f"SELECT assign_booking_cage('{first}','1');", role='parent', fail='PERMISSION_DENIED')
            sql(f"SELECT record_booking_attendance('{first}','checkin');", fail='actual_instructor_required')
            sql(f"SELECT record_booking_attendance('{first}','checkin','50000000-0000-0000-0000-000000000003');", fail='instructor_not_eligible_at_location')
            sql(f"SELECT record_booking_attendance('{first}','checkin','{COACH}');", role='coach', user='90000000-0000-0000-0000-000000000002')
            sql(f"SELECT record_booking_attendance('{first}','checkin','{COACH}');")
            assert sql(f"SELECT count(*) FROM sessions WHERE booking_id='{first}';") == '1'
            assert sql(f"SELECT coach_id IS NULL AND actual_coach_id='{COACH}' FROM bookings WHERE id='{first}';") == 't'
            correction = f"SELECT record_booking_attendance('{first}','correct','50000000-0000-0000-0000-000000000002','Correction');"
            for denied_role in ['parent', 'coach']:
                sql(correction, role=denied_role, user='90000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
            sql(correction, role='admin', user='90000000-0000-0000-0000-000000000003', fail='PERMISSION_DENIED')
            sql(correction, tenant='10000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
            sql(f"SELECT record_booking_attendance('{first}','correct','{COACH}','  ');",
                fail='completed_booking_instructor_and_reason_required')
            sql(f"SELECT record_booking_attendance('{first}','correct','50000000-0000-0000-0000-000000000003','Correction');",
                fail='instructor_not_eligible_at_location')
            # Approved correction permissions do not depend on legacy
            # capacity-policy flags; instructors cannot gain access via them.
            sql(f"SELECT record_booking_attendance('{first}','correct','50000000-0000-0000-0000-000000000002','Correction');")
            assert sql(f"SELECT count(*) FROM booking_instructor_history WHERE booking_id='{first}';") == '2'
            assert sql(f"SELECT coach_id FROM sessions WHERE booking_id='{first}';") == '50000000-0000-0000-0000-000000000002'
            assert sql(f"SELECT actor_id='{USER}' AND previous_coach_id='{COACH}'"
                       f" AND actual_coach_id='50000000-0000-0000-0000-000000000002' AND reason='Correction'"
                       f" AND recorded_at IS NOT NULL FROM booking_instructor_history WHERE booking_id='{first}' AND reason='Correction';") == 't'
            sql(f"SELECT record_booking_attendance('{first}','correct','{COACH}','Assigned admin correction');", role='admin')
            assert sql(f"SELECT count(*) FROM booking_instructor_history WHERE booking_id='{first}';") == '3'
            assert sql(f"SELECT coach_id FROM sessions WHERE booking_id='{first}';") == COACH
            assert sql(f"SELECT coach_id IS NULL FROM bookings WHERE id='{first}';") == 't'
            assert sql(f"SELECT sessions_remaining FROM memberships WHERE kid_id='{KID}';") == '29'
            assert sql("SELECT has_table_privilege('authenticated','booking_instructor_history','UPDATE');") == 'f'
            assert sql("SELECT has_function_privilege('authenticated','get_scoped_staff_checkin_roster(timestamptz,timestamptz)','EXECUTE');") == 'f'
            assert sql("SELECT get_staff_checkin_roster('2099-01-01','2099-01-02')->0->>'can_correct_instructor';", role='admin') == 'true'
            assert sql("SELECT get_staff_checkin_roster('2099-01-01','2099-01-02')->0->>'can_correct_instructor';",
                       role='coach', user='90000000-0000-0000-0000-000000000002') == 'false'
            # An idempotent check-in must not leave the attendance-write guard
            # enabled for subsequent statements in the same transaction.
            sql(f"BEGIN; SELECT record_booking_attendance('{first}','checkin','{COACH}');"
                f" UPDATE bookings SET status='confirmed' WHERE id='{first}'; COMMIT;", fail='attendance_rpc_required')
            # Match both current and historical gamification reason names,
            # without revoking achievements or unrelated existing points.
            sql(f"INSERT INTO points_ledger(kid_id,reference_type,reference_id,reason,delta)"
                f" VALUES('{KID}','booking','{first}','weekly_visit_bonus',2),"
                f"('{KID}','booking','{first}','session_attended',3),"
                f"('{KID}','achievement','{first}','achievement_bonus',10);"
                f" UPDATE kids SET points_balance=15 WHERE id='{KID}';")
            sql(f"SELECT undo_check_in('{first}');")
            assert sql(f"SELECT points_balance FROM kids WHERE id='{KID}';") == '10'
            assert sql(f"SELECT count(*) FROM points_ledger WHERE reference_id='{first}' AND reason IN ('weekly_visit_bonus','session_attended');") == '0'
            assert sql(f"SELECT count(*) FROM points_ledger WHERE reference_id='{first}' AND reason='achievement_bonus';") == '1'
            sql(f"DELETE FROM points_ledger WHERE reference_id='{first}' AND reason='achievement_bonus';"
                f" UPDATE kids SET points_balance=0 WHERE id='{KID}';")
            assert sql(f"SELECT actual_coach_id IS NULL AND attended_at IS NULL AND status='confirmed' FROM bookings WHERE id='{first}';") == 't'
            assert sql(f"SELECT count(*) FROM sessions WHERE booking_id='{first}';") == '0'
            sql(f"UPDATE bookings SET status='completed' WHERE id='{first}';", role='parent', fail='attendance_rpc_required')
            assert sql("SELECT jsonb_array_length(get_staff_checkin_roster('2099-01-01','2099-01-02'));") == '1'
            assert sql("SELECT jsonb_array_length(get_staff_checkin_roster('2099-01-01','2099-01-02'));",
                       role='admin', user='90000000-0000-0000-0000-000000000003') == '0'
            sql("SELECT get_staff_checkin_roster('2099-01-01','2099-01-02');", role='parent', fail='PERMISSION_DENIED')
            # Two independently committed transactions competing for the last slot.
            def race(_):
                try:
                    return create(start='2099-01-03T10:00:00Z', end='2099-01-03T11:00:00Z')
                except AssertionError as error:
                    assert 'slot_not_available' in str(error), str(error)
                    return None
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                winners = list(pool.map(race, range(2)))
            assert sum(winner is not None for winner in winners) == 1, winners
            # Replay races must return the same id, not consume another credit.
            key = str(uuid.uuid4())
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                replays = list(pool.map(lambda _: create(start='2099-01-04T10:00:00Z', end='2099-01-04T11:00:00Z', key=key), range(2)))
            assert len(set(replays)) == 1
            sql(f"SELECT set_manual_location_capacity('{LOCATION}',10,1);")
            assert sql("SELECT NOT instructor_corrections_approved AND cardinality(correction_roles)=0 FROM scheduling_location_rules;") == 't'
            sql(f"INSERT INTO scheduling_resources(tenant_id,location_id,cage_number,purpose) VALUES('{TENANT}','{LOCATION}','1','both');")
            create(start='2099-01-05T10:00:00Z', end='2099-01-05T11:00:00Z', cage="'1'")
            create(start='2099-01-05T10:30:00Z', end='2099-01-05T11:30:00Z', cage="'1'", fail='resource_not_available')
            # Configuration counts actual simultaneous occupancy, not daily
            # totals; adjacent reservations are not considered overlapping.
            create(start='2099-01-07T10:00:00Z', end='2099-01-07T11:00:00Z')
            create(start='2099-01-07T11:00:00Z', end='2099-01-07T12:00:00Z')
            sql(configure)
            sql(f"SELECT set_manual_location_capacity('{LOCATION}',10,1);")
            create(start='2099-01-07T10:30:00Z', end='2099-01-07T11:30:00Z')
            history_count = sql("SELECT count(*) FROM scheduling_capacity_history;")
            sql(configure, fail='capacity_below_existing_reservations')
            assert sql("SELECT count(*) FROM scheduling_capacity_history;") == history_count
            assert sql("SELECT lesson_capacity FROM scheduling_location_rules;") == '10'
            sql("UPDATE memberships SET sessions_remaining=0;")
            before = sql("SELECT count(*) FROM bookings;")
            create(start='2099-01-06T10:00:00Z', end='2099-01-06T11:00:00Z', fail='no_session_credits')
            assert sql("SELECT count(*) FROM bookings;") == before
            sql("UPDATE memberships SET sessions_remaining=3;")
            sql(f"INSERT INTO coach_availability(coach_id,tenant_id,day_of_week,start_time,end_time)"
                f" SELECT '{COACH}','{TENANT}',n,'09:00','18:00' FROM generate_series(0,6) n;")
            request_id = str(uuid.uuid4())
            customer = f"SELECT create_customer_booking('{KID}','{LOCATION}','{TYPE}','2099-02-01 10:00Z','{request_id}')->'booking'->>'id';"
            booked = sql(customer, role='parent', user='90000000-0000-0000-0000-000000000003')
            assert booked == sql(customer, role='parent', user='90000000-0000-0000-0000-000000000003')
            assert sql(f"SELECT sessions_remaining FROM memberships WHERE kid_id='{KID}';") == '2'
            sql(customer, role='parent', fail='PERMISSION_DENIED')
            assert sql("SELECT has_table_privilege('authenticated','bookings','DELETE');") == 'f'
            sql(f"SELECT cancel_booking('{first}',NULL,true);", role='parent', user='90000000-0000-0000-0000-000000000003', fail='PERMISSION_DENIED')
            sql(f"SELECT cancel_booking('{first}',NULL,true);", role='admin', user='90000000-0000-0000-0000-000000000003', fail='PERMISSION_DENIED')
            sql(f"SELECT cancel_booking('{first}',NULL,true);", role='admin')
            assert sql("SELECT jsonb_array_length(get_staff_checkin_roster('2099-01-01','2099-01-02'));") == '0'
            assert sql("SELECT has_function_privilege('authenticated','cancel_booking_policy_internal(uuid,text,boolean)','EXECUTE');") == 'f'
            sql("UPDATE memberships SET sessions_remaining=4; UPDATE session_types SET capacity=2;")
            request_id = str(uuid.uuid4())
            friend = f"SELECT book_session_with_friend('{TENANT}','{LOCATION}','{KID}','{COACH}','{TYPE}','2099-03-01 10:00Z','2099-03-01 11:00Z','Fixture guest',NULL,NULL,'{request_id}');"
            first_friend = sql(friend, role='parent', user='90000000-0000-0000-0000-000000000003')
            assert first_friend == sql(friend, role='parent', user='90000000-0000-0000-0000-000000000003')
            assert sql(f"SELECT sessions_remaining FROM memberships WHERE kid_id='{KID}';") == '2'
            assert sql("SELECT count(*) FROM bookings WHERE scheduled_start='2099-03-01 10:00Z';") == '2'
            # Recurring series reuse normal booking/credit logic atomically.
            def series(dates=None, key=None, cage='NULL', **kwargs):
                dates = dates if dates is not None else ['2099-05-01 10:00Z', '2099-05-08 10:00Z', '2099-05-15 10:00Z']
                key = key or str(uuid.uuid4())
                starts = 'ARRAY[' + ','.join("'" + date + "'" for date in dates) + ']::timestamptz[]'
                return json.loads(sql(f"SELECT create_staff_booking_series('{KID}','{LOCATION}','{TYPE}',"
                                      f"{starts},{cage},NULL,'{key}');", **kwargs) or 'null')

            def snapshot():
                return sql("SELECT json_build_object('bookings',(SELECT count(*) FROM bookings),"
                           "'series',(SELECT count(*) FROM booking_series),"
                           "'occurrences',(SELECT count(*) FROM booking_series_occurrences),"
                           "'receipts',(SELECT count(*) FROM booking_creation_requests),"
                           "'credits',(SELECT sessions_remaining FROM memberships LIMIT 1));")

            sql("UPDATE memberships SET sessions_remaining=30;")
            sql(f"SELECT set_manual_location_capacity('{LOCATION}',2,1);")
            for denied_role in ['parent', 'coach']:
                series(role=denied_role, fail='PERMISSION_DENIED')
            series(role='admin', user='90000000-0000-0000-0000-000000000003', fail='PERMISSION_DENIED')
            series(tenant='10000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
            before_series = snapshot()
            series(dates=[], fail='choose_2_to_52_occurrences')
            series(dates=['2099-05-01 10:00Z'], fail='choose_2_to_52_occurrences')
            series(dates=['2099-05-01 10:00Z', '2099-05-01 10:00Z'], fail='occurrences_must_be_future_unique_and_in_order')
            series(dates=['2099-05-01 11:00Z', '2099-05-01 10:00Z'], fail='occurrences_must_be_future_unique_and_in_order')
            series(dates=['2099-05-01 10:00Z', '2099-05-01 10:30Z'], fail='occurrences_must_be_future_unique_and_in_order')
            series(dates=['2000-05-01 10:00Z', '2099-05-01 10:00Z'], fail='occurrences_must_be_future_unique_and_in_order')
            assert snapshot() == before_series
            key = str(uuid.uuid4())
            first_series = series(key=key)
            assert first_series == series(key=key)
            assert len(first_series['bookings']) == 3
            assert len({b['id'] for b in first_series['bookings']}) == 3
            assert all(b['status'] == 'confirmed' and b['attended_at'] is None and b['actual_coach_id'] is None
                       for b in first_series['bookings'])
            assert sql("SELECT sessions_remaining FROM memberships LIMIT 1;") == '27'
            create(key=key, fail='idempotency_key_reused')
            series(key=key, cage="'1'", fail='idempotency_key_reused')
            first_occurrence = first_series['bookings'][0]['id']
            sql(f"SELECT assign_booking_cage('{first_occurrence}','1');")
            assert sql(f"SELECT count(*) FROM bookings b JOIN booking_series_occurrences o ON o.booking_id=b.id"
                       f" WHERE o.series_id='{first_series['series_id']}' AND b.cage_number IS NULL;") == '2'
            sql(f"SELECT cancel_booking('{first_occurrence}',NULL,true);")
            assert sql(f"SELECT count(*) FROM bookings b JOIN booking_series_occurrences o ON o.booking_id=b.id"
                       f" WHERE o.series_id='{first_series['series_id']}' AND b.status='confirmed';") == '2'
            assert sql(f"SELECT count(*) FROM booking_series_occurrences WHERE series_id='{first_series['series_id']}';") == '3'
            assert sql("SET ROLE authenticated; SELECT count(*) FROM booking_series;", role='parent') == '0'
            assert sql("SET ROLE authenticated; SELECT count(*) FROM booking_series;",
                       role='admin', user='90000000-0000-0000-0000-000000000003') == '0'
            assert sql("SELECT has_table_privilege('authenticated','booking_series_occurrences','UPDATE');") == 'f'
            # Insufficient credits at a later occurrence leave no partial work.
            sql("UPDATE memberships SET sessions_remaining=1;")
            before_series = snapshot()
            series(dates=['2099-06-01 10:00Z', '2099-06-08 10:00Z'], fail='no_session_credits')
            assert snapshot() == before_series
            sql("UPDATE memberships SET sessions_remaining=30;")
            for _ in range(2):
                create(start='2099-06-08 10:00Z', end='2099-06-08 11:00Z')
            before_series = snapshot()
            series(dates=['2099-06-01 10:00Z', '2099-06-08 10:00Z'], fail='slot_not_available')
            assert snapshot() == before_series
            create(start='2099-07-08 10:00Z', end='2099-07-08 11:00Z', cage="'1'")
            before_series = snapshot()
            series(dates=['2099-07-01 10:00Z', '2099-07-08 10:00Z'], cage="'1'", fail='resource_not_available')
            assert snapshot() == before_series
            key = str(uuid.uuid4())
            replay_dates = ['2099-08-01 10:00Z', '2099-08-08 10:00Z']
            credits_before = int(sql("SELECT sessions_remaining FROM memberships LIMIT 1;"))
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                series_replays = list(pool.map(lambda _: series(dates=replay_dates, key=key), range(2)))
            assert series_replays[0] == series_replays[1]
            assert int(sql("SELECT sessions_remaining FROM memberships LIMIT 1;")) == credits_before - 2
            create(start='2099-09-01 10:00Z', end='2099-09-01 11:00Z')
            def series_race(_):
                try:
                    return series(dates=['2099-09-01 10:00Z', '2099-09-08 10:00Z'])
                except AssertionError as error:
                    assert 'slot_not_available' in str(error), str(error)
                    return None
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                series_winners = list(pool.map(series_race, range(2)))
            assert sum(winner is not None for winner in series_winners) == 1
            assert sql("SELECT count(*) FROM bookings WHERE scheduled_start='2099-09-01 10:00Z';") == '2'
            assert sql("SELECT count(*) FROM bookings WHERE scheduled_start='2099-09-08 10:00Z';") == '1'
            run_override_tests(sql, create, series, TENANT, LOCATION, KID, TYPE, USER)
            run_resource_tests(sql, create, TENANT, LOCATION, KID, USER)
            run_friend_rental_tests(sql, TENANT, LOCATION, KID)
            run_camp_tests(sql, create, TENANT, LOCATION, KID, USER)
            run_waitlist_tests(sql, create, TENANT, LOCATION, KID)
            print('PASS: migrations, persisted roster, scope, capacity race, manual configuration permissions/audit/reduction, walk-in permissions/roster/replay/race/resources/credit rollback, replay race, resources, credits, actual instructor, correction audit, undo, recurring isolation/replay/race/atomic rollback')
        finally:
            subprocess.run(['pg_ctl', '-D', str(cluster), '-m', 'immediate', 'stop'], check=True, stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
