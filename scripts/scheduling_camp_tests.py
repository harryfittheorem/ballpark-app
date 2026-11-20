"""Camp policy gates and synthetic confirmation fulfillment in local fixtures.

No payment provider is called. Financial approval is set ONLY inside the
disposable PostgreSQL test cluster to exercise otherwise-disabled code.
"""
import concurrent.futures
import json
import uuid


def run_camp_tests(sql, create, tenant, location, kid, user):
    group_type = '60000000-0000-0000-0000-000000000003'
    coach = '50000000-0000-0000-0000-000000000001'
    kid2 = '40000000-0000-0000-0000-000000000002'
    kid3 = '40000000-0000-0000-0000-000000000003'
    sql("UPDATE memberships SET sessions_remaining=30;")
    sql(f"INSERT INTO kids(id,family_id,first_name,last_name)"
        f" VALUES('{kid3}','30000000-0000-0000-0000-000000000001','Third','Fixture');")
    sql(f"SELECT set_scheduling_resource('{location}','C1','both',true,'Fixture camp cage');")

    def draft(days=None, key=None, event=None, version=None, name='Fixture camp', **kwargs):
        days = days if days is not None else [
            {'starts_at': '2104-05-01T10:00:00Z', 'ends_at': '2104-05-01T11:00:00Z', 'cage_number': 'C1'},
            {'starts_at': '2104-05-02T10:00:00Z', 'ends_at': '2104-05-02T11:00:00Z', 'cage_number': 'C1'},
        ]
        event_arg = f"'{event}'" if event else 'NULL'
        version_arg = str(version) if version is not None else 'NULL'
        payload = json.dumps(days).replace("'", "''")
        return sql(f"SELECT save_camp_draft({event_arg},'{location}','{name}','camp','{group_type}',2,"
                   f"'{payload}'::jsonb,'{key or uuid.uuid4()}',{version_arg});", **kwargs)

    def confirmation(event, athlete=kid, status='confirmed', purchase_tenant=tenant):
        return sql(f"INSERT INTO camp_purchase_confirmations(tenant_id,event_id,kid_id,external_reference,status)"
                   f" VALUES('{purchase_tenant}','{event}','{athlete}','fixture-{uuid.uuid4()}','{status}') RETURNING id;")

    def enable_fixture(event):
        # Test cluster only. No application action or migration enables sales.
        sql(f"UPDATE camp_events SET status='ready',sales_enabled=true,financial_policy_reference='Isolated fixture approval only',"
            f" financial_policy_approved_by='{user}',financial_policy_approved_at=now() WHERE id='{event}';")

    def fulfill(purchase, **kwargs):
        return json.loads(sql(f"SET ROLE service_role; SELECT fulfill_confirmed_camp_purchase('{purchase}');",
                              jwt_role='service_role', **kwargs) or 'null')

    def snapshot():
        return sql("SELECT json_build_array((SELECT count(*) FROM bookings),(SELECT count(*) FROM camp_enrollments),"
                   "(SELECT count(*) FROM camp_roster_entries),(SELECT count(*) FROM sessions),"
                   "(SELECT sessions_remaining FROM memberships LIMIT 1));")

    for role in ['parent', 'coach']:
        draft(role=role, fail='PERMISSION_DENIED')
    draft(role='admin', user='90000000-0000-0000-0000-000000000003', fail='PERMISSION_DENIED')
    draft(tenant='10000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
    draft(days=[], fail='choose_1_to_60_event_days')
    draft(days=[{'starts_at': '2104-05-01T12:00Z', 'ends_at': '2104-05-01T11:00Z'}],
          fail='event_days_must_be_future_ordered_and_nonoverlapping')
    before = snapshot()
    key = str(uuid.uuid4())
    event = draft(key=key, role='admin')
    assert draft(key=key, role='admin') == event
    draft(key=key, name='Different', role='admin', fail='idempotency_key_reused')
    assert snapshot() == before  # Drafts create neither enrollment nor attendance.
    assert sql(f"SELECT NOT sales_enabled AND financial_policy_approved_at IS NULL FROM camp_events WHERE id='{event}';") == 't'
    draft(event=event, version=1, name='Edited fixture camp')
    draft(event=event, version=1, name='Stale', fail='camp_draft_changed_refresh_required')
    def edit_race(index):
        try:
            return draft(event=event, version=2, name=f'Concurrent edit {index}')
        except AssertionError as error:
            assert 'camp_draft_changed_refresh_required' in str(error)
            return None
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        edits = list(pool.map(edit_race, range(2)))
    assert sum(edit is not None for edit in edits) == 1
    archived = draft(name='Archive fixture')
    sql(f"SELECT archive_camp_draft('{archived}');")
    assert sql(f"SELECT count(*) FROM camp_event_days WHERE event_id='{archived}';") == '2'
    draft(event=archived, version=2, fail='camp_schedule_locked')
    sql(f"SELECT set_scheduling_resource('{location}','C1','both',false,'Retire used camp cage');", fail='resource_has_future_reservations')
    purchase = confirmation(event)
    before = snapshot()
    fulfill(purchase, fail='camp_sales_disabled')
    assert snapshot() == before
    sql(f"SET ROLE authenticated; SELECT fulfill_confirmed_camp_purchase('{purchase}');", fail='permission denied')
    sql(f"SET ROLE authenticated; UPDATE camp_events SET sales_enabled=true WHERE id='{event}';", fail='permission denied')
    draft(event=event, version=3, fail='camp_schedule_locked')
    enable_fixture(event)
    enrolled = fulfill(purchase)
    assert len(enrolled['booking_ids']) == 2
    assert enrolled == fulfill(purchase)
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        replays = list(pool.map(lambda _: fulfill(purchase), range(2)))
    assert replays[0] == replays[1] == enrolled
    assert sql("SELECT sessions_remaining FROM memberships LIMIT 1;") == '30'
    ids = ','.join("'" + value + "'" for value in enrolled['booking_ids'])
    assert sql(f"SELECT count(*) FROM bookings WHERE id IN ({ids}) AND status='confirmed' AND attended_at IS NULL AND actual_coach_id IS NULL;") == '2'
    assert sql(f"SELECT count(*) FROM sessions WHERE booking_id IN ({ids});") == '0'
    second, third = confirmation(event, kid2), confirmation(event, kid3)
    def seat_race(paid):
        try:
            return fulfill(paid)
        except AssertionError as error:
            assert 'camp_capacity_reached' in str(error)
            return None
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        winners = list(pool.map(seat_race, [second, third]))
    assert sum(winner is not None for winner in winners) == 1
    assert sql(f"SELECT count(*) FROM camp_enrollments WHERE event_id='{event}';") == '2'
    assert sql(f"SELECT count(*) FROM camp_roster_entries r JOIN camp_event_days d ON d.id=r.day_id WHERE d.event_id='{event}';") == '4'
    duplicate = confirmation(event)
    fulfill(duplicate, fail='athlete_already_enrolled_requires_payment_review')
    wrong_tenant = confirmation(event, purchase_tenant='10000000-0000-0000-0000-000000000002')
    fulfill(wrong_tenant, fail='invalid_camp_purchase_references')
    cancelled = confirmation(event, status='cancelled')
    fulfill(cancelled, fail='confirmed_camp_purchase_required')
    sql(f"SELECT archive_camp_draft('{event}');", fail='camp_schedule_locked')
    roster = json.loads(sql("SELECT get_staff_checkin_roster('2104-05-01','2104-05-02');"))
    assert len(roster) == 2 and all(row['camp_event_id'] == event and row['offering_category'] == 'camp' and row['type_category'] == 'group' and row['cage_number'] == 'C1' for row in roster)
    first_booking = enrolled['booking_ids'][0]
    sql(f"SELECT record_booking_attendance('{first_booking}','checkin','{coach}');")
    assert sql(f"SELECT count(*) FROM bookings WHERE id IN ({ids}) AND attended_at IS NOT NULL;") == '1'
    assert sql(f"SELECT count(*) FROM sessions WHERE booking_id IN ({ids});") == '1'
    sql(f"SELECT undo_check_in('{first_booking}');")
    assert sql(f"SELECT count(*) FROM bookings WHERE id IN ({ids}) AND attended_at IS NULL;") == '2'
    sql(f"SELECT cancel_booking('{first_booking}',NULL,true);", fail='camp_cancellation_policy_required')
    sql(f"SELECT assign_booking_cage('{first_booking}','1');", fail='camp_schedule_locked')
    # Capacity permission does not override a camp's physical cage hold.
    sql(f"SELECT set_booking_capacity_override('{location}','lesson','2104-05-01 10:00Z','2104-05-01 11:00Z',3,'Fixture extra lesson capacity');")
    create(start='2104-05-01 10:00Z', end='2104-05-01 11:00Z', cage="'C1'", fail='resource_not_available')
    sql(f"INSERT INTO bookings(tenant_id,location_id,kid_id,session_type_id,scheduled_start,scheduled_end,status)"
        f" VALUES('{tenant}','{location}','{kid}','{group_type}','2104-09-01 10:00Z','2104-09-01 11:00Z','confirmed');",
        role='parent', fail='camp_or_clinic_event_workflow_required')

    def failed_event(month, resource_conflict):
        days = [{'starts_at': f'2104-{month:02d}-{day:02d}T10:00:00Z', 'ends_at': f'2104-{month:02d}-{day:02d}T11:00:00Z', 'cage_number': 'C1'} for day in [1, 2]]
        failed = draft(days=days, name=f'Rollback fixture {month}')
        if resource_conflict:
            create(start=f'2104-{month:02d}-02 10:00Z', end=f'2104-{month:02d}-02 11:00Z', cage="'C1'")
        else:
            for _ in range(2):
                create(start=f'2104-{month:02d}-02 10:00Z', end=f'2104-{month:02d}-02 11:00Z')
        paid = confirmation(failed)
        enable_fixture(failed)
        initial = snapshot()
        fulfill(paid, fail='camp_resource_not_available' if resource_conflict else 'slot_not_available')
        assert snapshot() == initial
        assert sql(f"SELECT count(*) FROM camp_enrollments WHERE event_id='{failed}';") == '0'
    failed_event(6, True)
    failed_event(7, False)
    assert sql("SET ROLE authenticated; SELECT count(*) FROM camp_enrollments;", role='parent') == '0'
    assert sql("SET ROLE authenticated; SELECT count(*) FROM camp_enrollments;",
               role='admin', user='90000000-0000-0000-0000-000000000003') == '0'
    assert sql("SELECT has_table_privilege('authenticated','camp_purchase_confirmations','INSERT');") == 'f'
    assert sql("SELECT has_table_privilege('authenticated','camp_events','UPDATE');") == 'f'
    print('PASS: camp drafts/replays/edit isolation, disabled sales, trusted fulfillment, full roster replay/capacity races, later-day rollback, daily attendance/undo and cage holds')
