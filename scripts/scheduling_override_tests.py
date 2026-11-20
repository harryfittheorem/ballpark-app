"""Dated-capacity regression cases, run only against the disposable fixture."""
import concurrent.futures


def run_override_tests(sql, create, series, tenant, location, kid, session_type, user):
    sql("UPDATE memberships SET sessions_remaining=100;")
    sql(f"SELECT set_manual_location_capacity('{location}',2,1);")

    def override(start='2101-05-01 10:00Z', end='2101-05-01 11:00Z', capacity=3,
                 category='lesson', reason='Fixture approved override', **kwargs):
        return sql(f"SELECT set_booking_capacity_override('{location}','{category}','{start}','{end}',"
                   f"{capacity},'{reason}');", **kwargs)

    for role in ['parent', 'coach']:
        override(role=role, fail='PERMISSION_DENIED')
    override(role='admin', user='90000000-0000-0000-0000-000000000003', fail='PERMISSION_DENIED')
    override(tenant='10000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
    override(capacity=0, fail='valid_window_capacity_and_reason_required')
    override(reason=' ', fail='valid_window_capacity_and_reason_required')
    override(start='infinity', fail='valid_window_capacity_and_reason_required')
    override(start='2101-05-01 12:00Z', fail='valid_window_capacity_and_reason_required')
    override(category='unknown', fail='valid_window_capacity_and_reason_required')
    sql("SELECT set_booking_capacity_override('20000000-0000-0000-0000-000000000002',"
        "'lesson','2101-05-01 10:00Z','2101-05-01 11:00Z',3,'No baseline');", fail='capacity_policy_required')

    weekly = series(dates=['2101-05-01 10:00Z', '2101-05-08 10:00Z'])
    before_credits = sql("SELECT sessions_remaining FROM memberships LIMIT 1;")
    window_id = override(role='admin')
    assert override(role='admin') == window_id
    assert sql("SELECT sessions_remaining FROM memberships LIMIT 1;") == before_credits
    assert sql(f"SELECT count(*) FROM scheduling_override_history WHERE override_id='{window_id}';") == '1'
    assert sql(f"SELECT actor_id='{user}' AND previous_capacity IS NULL AND new_capacity=3"
               f" AND changed_at IS NOT NULL FROM scheduling_override_history WHERE override_id='{window_id}';") == 't'
    extras = [create(start='2101-05-01 10:00Z', end='2101-05-01 11:00Z') for _ in range(2)]
    create(start='2101-05-01 10:00Z', end='2101-05-01 11:00Z', fail='slot_not_available')
    first = weekly['bookings'][0]['id']
    sql(f"SELECT assign_booking_cage('{first}','1');")
    create(start='2101-05-01 10:00Z', end='2101-05-01 11:00Z', cage="'1'", fail='resource_not_available')
    create(start='2101-05-08 10:00Z', end='2101-05-08 11:00Z')
    create(start='2101-05-08 10:00Z', end='2101-05-08 11:00Z', fail='slot_not_available')
    assert sql(f"SELECT lesson_capacity FROM scheduling_location_rules WHERE location_id='{location}';") == '2'
    override(capacity=2, fail='capacity_below_existing_reservations')
    sql(f"SELECT remove_booking_capacity_override('{window_id}','Restore normal');", fail='capacity_below_existing_reservations')
    assert sql(f"SELECT count(*) FROM scheduling_override_history WHERE override_id='{window_id}';") == '1'
    sql(f"SELECT cancel_booking('{extras[-1]}',NULL,true);")
    sql(f"SELECT remove_booking_capacity_override('{window_id}','Restore normal');", role='admin')
    sql(f"SELECT remove_booking_capacity_override('{window_id}','Restore normal');", role='admin')
    assert sql(f"SELECT count(*) FROM scheduling_override_history WHERE override_id='{window_id}';") == '2'
    assert sql(f"SELECT is_active FROM scheduling_capacity_overrides WHERE id='{window_id}';") == 'f'
    create(start='2101-05-01 10:00Z', end='2101-05-01 11:00Z', fail='slot_not_available')
    assert override(capacity=4, reason='Reactivate') == window_id
    assert override(capacity=3, reason='Adjust this date') == window_id
    sql(f"SELECT set_manual_location_capacity('{location}',2,1);")

    # Removing the exception and filling its last slot must serialize.
    def remove_or_book(index):
        try:
            if index == 0:
                return create(start='2101-05-01 10:00Z', end='2101-05-01 11:00Z')
            sql(f"SELECT remove_booking_capacity_override('{window_id}','Concurrent restoration');")
            return 'removed'
        except AssertionError as error:
            assert any(message in str(error) for message in ['slot_not_available', 'capacity_below_existing_reservations'])
            return None
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        results = list(pool.map(remove_or_book, range(2)))
    assert sum(result is not None for result in results) == 1
    active = sql(f"SELECT is_active FROM scheduling_capacity_overrides WHERE id='{window_id}';") == 't'
    assert sql("SELECT count(*) FROM bookings WHERE scheduled_start='2101-05-01 10:00Z' AND status<>'cancelled';") == ('3' if active else '2')
    sql(f"SELECT set_manual_location_capacity('{location}',2,1);")

    override(start='2101-06-01 10:00Z', end='2101-06-01 11:00Z')
    for _ in range(2):
        create(start='2101-06-01 10:00Z', end='2101-06-01 11:00Z')
    def final_slot(_):
        try:
            return create(start='2101-06-01 10:00Z', end='2101-06-01 11:00Z')
        except AssertionError as error:
            assert 'slot_not_available' in str(error)
            return None
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        winners = list(pool.map(final_slot, range(2)))
    assert sum(winner is not None for winner in winners) == 1

    # A window cannot authorize extra occupancy before its start or after
    # its end, even if the same booking fits during the raised window.
    override(start='2101-07-01 10:00Z', end='2101-07-01 11:00Z')
    override(start='2101-07-08 10:00Z', end='2101-07-08 11:00Z')
    for _ in range(2):
        create(start='2101-07-01 09:30Z', end='2101-07-01 10:30Z')
        create(start='2101-07-08 10:30Z', end='2101-07-08 11:30Z')
    create(start='2101-07-01 09:45Z', end='2101-07-01 10:45Z', fail='slot_not_available')
    create(start='2101-07-08 10:45Z', end='2101-07-08 11:45Z', fail='slot_not_available')
    override(start='2101-07-01 10:30Z', end='2101-07-01 11:30Z', fail='overlapping_capacity_override')
    override(start='2101-07-01 11:00Z', end='2101-07-01 12:00Z')  # adjacent is valid
    override(start='2101-07-01 10:30Z', end='2101-07-01 11:30Z', category='rental')
    sql(f"SELECT set_manual_location_capacity('{location}',1,1);", fail='capacity_below_existing_reservations')
    assert sql(f"SELECT lesson_capacity FROM scheduling_location_rules WHERE location_id='{location}';") == '2'

    # A raw multi-row legacy INSERT must not bypass capacity via snapshots.
    before = sql("SELECT count(*) FROM bookings;")
    sql(f"INSERT INTO bookings(tenant_id,location_id,kid_id,session_type_id,scheduled_start,scheduled_end,status)"
        f" SELECT '{tenant}','{location}','{kid}','{session_type}','2101-10-01 10:00Z','2101-10-01 11:00Z','confirmed'"
        " FROM generate_series(1,3);", fail='slot_not_available')
    assert sql("SELECT count(*) FROM bookings;") == before

    def overlapping_window(index):
        try:
            return override(start=f'2101-11-01 10:{index * 30:02d}Z', end=f'2101-11-01 11:{index * 30:02d}Z')
        except AssertionError as error:
            assert 'overlapping_capacity_override' in str(error)
            return None
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        winners = list(pool.map(overlapping_window, range(2)))
    assert sum(winner is not None for winner in winners) == 1
    assert sql("SET ROLE authenticated; SELECT count(*) FROM scheduling_capacity_overrides;", role='parent') == '0'
    assert sql("SET ROLE authenticated; SELECT count(*) FROM scheduling_capacity_overrides;",
               role='admin', user='90000000-0000-0000-0000-000000000003') == '0'
    assert sql("SET ROLE authenticated; SELECT count(*) FROM scheduling_capacity_overrides;",
               tenant='10000000-0000-0000-0000-000000000002') == '0'
    assert sql("SELECT has_table_privilege('authenticated','scheduling_override_history','UPDATE');") == 'f'
    assert sql("SELECT has_table_privilege('authenticated','scheduling_capacity_overrides','UPDATE');") == 'f'
    assert sql("SELECT has_function_privilege('authenticated',"
               "'booking_capacity_has_room(uuid,uuid,boolean,timestamptz,timestamptz,uuid,integer)','EXECUTE');") == 'f'
    assert sql(f"SELECT count(*) FROM bookings b JOIN booking_series_occurrences o ON o.booking_id=b.id"
               f" WHERE o.series_id='{weekly['series_id']}' AND b.scheduled_start=o.original_start;") == '2'
    print('PASS: dated override permissions/audit/replay, recurring-date isolation, interval boundaries, cage protection, safe removal/reduction and concurrency races')
