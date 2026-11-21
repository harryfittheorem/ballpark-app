#!/usr/bin/env python3
"""R07 authorization, persistence, history, retries and report reconciliation.

Uses disposable PostgreSQL only; no application credentials or data.
"""
import concurrent.futures
import json
from pathlib import Path
import re
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
TENANT = '10000000-0000-0000-0000-000000000001'
USER = '90000000-0000-0000-0000-000000000001'
COACH_USER = '90000000-0000-0000-0000-000000000002'
PARENT = '90000000-0000-0000-0000-000000000003'
KID = '40000000-0000-0000-0000-000000000001'
COACH = '50000000-0000-0000-0000-000000000001'
BOOKING = '70000000-0000-0000-0000-000000000001'


def main():
    with tempfile.TemporaryDirectory(prefix='coaching-test-') as directory:
        cluster = Path(directory)/'db'
        subprocess.run(['initdb', '-D', str(cluster), '-U', 'postgres', '-A', 'trust', '--no-locale'],
                       check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['pg_ctl', '-D', str(cluster), '-l', str(Path(directory)/'postgres.log'),
                        '-o', f"-k {directory} -c listen_addresses='' -p 15439", 'start'],
                       check=True, stdout=subprocess.DEVNULL)
        try:
            def sql(text, role='owner', user=USER, tenant=TENANT, fail=None, authenticated=True):
                claims = json.dumps({'sub': user, 'tenant_id': tenant, 'app_role': role, 'role': 'authenticated'})
                query = f"SET request.jwt.claims='{claims}';\n"
                if authenticated:
                    query += 'SET ROLE authenticated;\n'
                result = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', directory,
                                         '-p', '15439', '-d', 'postgres'],
                                        input=query+text, text=True, capture_output=True)
                if fail:
                    assert result.returncode and fail in result.stderr, (fail, result.stdout, result.stderr)
                else:
                    assert result.returncode == 0, result.stderr
                return result.stdout.strip()

            sql((ROOT/'scripts/fixtures/scheduling.sql').read_text(), authenticated=False)
            sql("ALTER TABLE bookings ADD COLUMN actual_coach_id uuid; "
                "CREATE TABLE coach_messages(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,sender_user_id uuid,"
                "recipient_family_id uuid,recipient_kid_id uuid,recipient_coach_user_id uuid,message_text text,video_id uuid,viewed_at timestamptz);"
                "GRANT ALL ON coach_messages TO authenticated;", authenticated=False)
            source = (ROOT/'supabase/migrations/20261120000010_scheduling_integrity.sql').read_text()
            sql(re.search(r'CREATE FUNCTION public.can_manage_booking_location\(.*?\$\$;', source, re.S).group(),
                authenticated=False)
            for filename in ['20261120120000_coaching_phone_records.sql', '20261120120001_coaching_reports.sql',
                             '20261120120002_coaching_messaging_boundary.sql',
                             '20261120120003_coaching_privileged_api_boundary.sql',
                             '20261120120004_coaching_calendar_dates.sql',
                             '20261120120005_player_lesson_drilldown.sql']:
                sql((ROOT/'supabase/migrations'/filename).read_text(), authenticated=False)
            # An ended completed lesson with real R06 actual attribution.
            sql(f"INSERT INTO bookings(id,tenant_id,location_id,kid_id,coach_id,actual_coach_id,session_type_id,"
                f"scheduled_start,scheduled_end,status) VALUES ('{BOOKING}','{TENANT}',"
                f"'20000000-0000-0000-0000-000000000001','{KID}','{COACH}','{COACH}',"
                "'60000000-0000-0000-0000-000000000001',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','completed');",
                authenticated=False)
            def write(kind, data, key=None, subject=BOOKING, **kwargs):
                return json.loads(sql(f"SELECT save_coaching_record('{key or uuid.uuid4()}','{kind}','{subject}',"
                                      f"'{json.dumps(data)}'::jsonb);", **kwargs))

            note = {'recorded_on': '2026-01-01', 'lesson_number': 1, 'body': 'Private instruction'}
            key = str(uuid.uuid4())
            saved = write('note', note, key=key, role='coach', user=COACH_USER)
            assert write('note', note, key=key, role='coach', user=COACH_USER)['id'] == saved['id']
            # Independent connections simulate a second device, not an in-memory cache.
            bundle = f"SELECT get_staff_coaching_records('{BOOKING}');"
            assert len(json.loads(sql(bundle, role='coach', user=COACH_USER))['notes']) == 1
            assert json.loads(sql(bundle))['notes'] == []  # owner has no implicit note readership
            for role in ['owner', 'admin', 'super_admin', 'parent', 'player']:
                assert sql("SELECT count(*) FROM private_lesson_notes;", role=role, user=USER) == '0'
            sql("SET ROLE service_role; SELECT * FROM private_lesson_notes;", authenticated=False, fail='permission denied')
            sql(bundle, role='parent', user=PARENT, fail='PERMISSION_DENIED')
            sql(bundle, role='player', user=PARENT, fail='PERMISSION_DENIED')
            sql(bundle, role='coach', user=COACH_USER,
                tenant='10000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
            sql(bundle, role='admin', user=PARENT, fail='PERMISSION_DENIED')  # unassigned location
            sql(f"SELECT save_coaching_record('{key}','note','{BOOKING}',"
                f"'{json.dumps({**note, 'body': 'Changed'})}');",
                role='coach', user=COACH_USER, fail='request_id_payload_conflict')
            measurement = {'recorded_on': '2026-01-01', 'average_ev': 65.2, 'peak_ev': 76, 'unit': 'mph'}
            m = write('measurement', measurement)
            corrected = write('measurement', {**measurement, 'peak_ev': 77, 'replaces_id': m['id'], 'correction_reason': 'Transcription correction'})
            assert corrected['source'] == 'manual' and corrected['recorded_by'] == USER
            assert corrected['replaces_id'] == m['id']
            assert len(json.loads(sql(bundle))['measurements']) == 2
            for table in ['coaching_measurements', 'private_lesson_notes', 'self_reported_games', 'lesson_ratings']:
                sql(f"DELETE FROM {table};", fail='permission denied')
            sql(f"UPDATE coaching_measurements SET average_ev=12 WHERE id='{m['id']}';",
                authenticated=False, fail='coaching_history_is_append_only')
            sql(f"SELECT save_coaching_record('{uuid.uuid4()}','measurement','{BOOKING}',"
                f"'{json.dumps({**measurement, 'peak_ev': 1})}');", fail='check constraint')
            sql(f"SELECT save_coaching_record('{uuid.uuid4()}','measurement','{BOOKING}',"
                f"'{json.dumps(measurement)}');", role='parent', user=PARENT, fail='PERMISSION_DENIED')
            game = {'played_on': '2026-01-01', 'at_bats': 4, 'singles': 1, 'doubles': 1, 'triples': 0,
                    'home_runs': 0, 'strikeouts': 1, 'walks': 1, 'rbis': 2, 'notes': 'Family reported'}
            gkey = str(uuid.uuid4())
            g = write('game', game, subject=KID, role='parent', user=PARENT, key=gkey)
            assert g['source'] == 'self_reported' and g['hits'] == 2
            assert write('game', game, subject=KID, role='parent', user=PARENT, key=gkey)['id'] == g['id']
            assert len(json.loads(sql(bundle, role='coach', user=COACH_USER))['games']) == 1
            for body in [{**game, 'at_bats': 1}, {**game, 'walks': -1}, {**game, 'played_on': '2099-01-01'}]:
                sql(f"SELECT save_coaching_record('{uuid.uuid4()}','game','{KID}','{json.dumps(body)}');",
                    role='parent', user=PARENT, fail='date_required' if body['played_on']=='2099-01-01' else 'check constraint')
            sql(f"SELECT get_family_coaching_records('{KID}');", role='parent', user=USER, fail='PERMISSION_DENIED')
            sql(f"SELECT get_family_coaching_records('{KID}');", role='coach', user=COACH_USER, fail='PERMISSION_DENIED')
            rating = f"SELECT rate_coaching_lesson('{BOOKING}',5,'Helpful');"
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda _: sql(rating, role='parent', user=PARENT), range(2)))
            assert results[0] == results[1]
            sql(f"SELECT rate_coaching_lesson('{BOOKING}',4,'Changed');", role='parent', user=PARENT, fail='no_edits')
            sql(f"SELECT rate_coaching_lesson('{BOOKING}',6,'');", role='parent', user=PARENT, fail='invalid_lesson_rating')
            sql(rating, role='coach', user=COACH_USER, fail='PERMISSION_DENIED')
            report_query = "SELECT get_coaching_report(current_date-7,current_date);"
            report = json.loads(sql(report_query))[0]
            assert report['rated_count'] == report['eligible_count'] == report['completed_count'] == 1
            assert report['avg_rating'] == 5 and report['lessons'][0]['rating'] == 5
            assert report['original_hire_date'] is None and report['first_anniversary'] is None
            sql(report_query, role='parent', user=PARENT, fail='PERMISSION_DENIED')
            # Audited corrections in R06 change report attribution, never the rating snapshot.
            sql(f"UPDATE bookings SET actual_coach_id='50000000-0000-0000-0000-000000000002' WHERE id='{BOOKING}';",
                authenticated=False)
            assert json.loads(sql(report_query))[0]['coach_id'].endswith('0002')
            assert sql("SELECT submitted_coach_id FROM lesson_ratings;") == COACH
            # An unrated eligible lesson must increase the denominator only.
            sql(f"INSERT INTO bookings SELECT '70000000-0000-0000-0000-000000000002',tenant_id,location_id,kid_id,coach_id,"
                "session_type_id,scheduled_start,scheduled_end,cage_number,notes,status,attended_at,cancelled_at,cancellation_reason,"
                f"updated_at,is_guest,guest_name,guest_phone,guest_email,actual_coach_id FROM bookings WHERE id='{BOOKING}';",
                authenticated=False)
            report = json.loads(sql(report_query))[0]
            assert report['eligible_count'] == 2 and report['rated_count'] == 1 and report['avg_rating'] == 5
            history = json.loads(sql(f"SELECT get_player_coaching_history('{KID}',1);"))
            assert history['total'] == 2 and len(history['rows']) == 2
            assert sum(1 for row in history['rows'] if row['rating'] == 5) == 1
            sql(f"SELECT get_player_coaching_history('{KID}',1);", role='parent', user=PARENT, fail='PERMISSION_DENIED')
            for suffix, status in [('3', 'no_show'), ('4', 'cancelled')]:
                sql(f"INSERT INTO bookings SELECT '70000000-0000-0000-0000-00000000000{suffix}',tenant_id,location_id,kid_id,coach_id,"
                    f"session_type_id,scheduled_start,scheduled_end,cage_number,notes,'{status}',attended_at,cancelled_at,cancellation_reason,"
                    f"updated_at,is_guest,guest_name,guest_phone,guest_email,NULL FROM bookings WHERE id='{BOOKING}';",
                    authenticated=False)
            unknown = next(r for r in json.loads(sql(report_query)) if r['coach_id'] == 'unattributed')
            assert unknown['no_show_count'] == unknown['cancelled_count'] == 1
            assert unknown['eligible_count'] == unknown['rated_count'] == unknown['completed_count'] == 0
            assert all(row['actual_coach_name'] is None and row['rating'] is None for row in unknown['lessons'])
            # Messaging: preserve inbound guardian records and viewed receipts, deny outbound even privileged writes.
            inbound = (f"INSERT INTO coach_messages(tenant_id,sender_user_id,recipient_family_id,recipient_kid_id,"
                       f"recipient_coach_user_id,message_text) VALUES ('{TENANT}','{PARENT}',"
                       f"'30000000-0000-0000-0000-000000000001','{KID}','{COACH_USER}','Parent question');")
            sql(inbound)
            sql("UPDATE coach_messages SET viewed_at=now();")
            sql("UPDATE coach_messages SET recipient_coach_user_id=NULL;", fail='policy_approval')
            sql(inbound.replace(f"'{COACH_USER}','Parent question'", "NULL,'Outbound'"),
                authenticated=False, fail='policy_approval')
            assert sql("SELECT count(*) FROM coaching_audit;", authenticated=False) == '5'
            print('PASS: author-only notes, tenant/location/family boundaries, independent-device persistence, '
                  'manual provenance/corrections/immutability, game validation/retries, concurrent rating uniqueness, '
                  'actual-instructor attribution, coverage denominators and messaging gates.')
        finally:
            subprocess.run(['pg_ctl', '-D', str(cluster), '-m', 'immediate', 'stop'],
                           check=True, stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    main()
