"""Rental allocation and inventory checks against disposable scheduling data."""
import concurrent.futures
import json
import uuid


def run_resource_tests(sql, create, tenant, location, kid, user):
    rental_type = '60000000-0000-0000-0000-000000000002'
    sql("UPDATE memberships SET sessions_remaining=30;")

    def configure(purpose='both', active=True, **kwargs):
        return sql(f"SELECT set_scheduling_resource('{location}','R2','{purpose}',"
                   f"{str(active).lower()},'Fixture inventory change');", **kwargs)

    for role in ['parent', 'coach', 'admin']:
        configure(role=role, fail='PERMISSION_DENIED')
    configure(tenant='10000000-0000-0000-0000-000000000002', fail='PERMISSION_DENIED')
    resource = configure()
    assert configure() == resource
    assert sql(f"SELECT count(*) FROM scheduling_resource_history WHERE resource_id='{resource}';") == '1'
    assert sql(f"SELECT actor_id='{user}' FROM scheduling_resource_history WHERE resource_id='{resource}';") == 't'

    def rental(start='2103-05-01 10:00Z', end='2103-05-01 11:00Z', cage='NULL', **kwargs):
        return sql(f"SELECT create_staff_booking('{kid}','{location}','{rental_type}','{start}','{end}',"
                   f"NULL,{cage},NULL,'{uuid.uuid4()}')->>'id';", **kwargs)

    rental(fail='rental_cage_required')
    rental(cage="'walkin-fixture'", fail='resource_policy_required')
    booked = rental(cage="'R2'")
    rental(cage="'R2'", fail='resource_not_available')
    configure(active=False, fail='resource_has_future_reservations')
    configure(purpose='instruction', fail='resource_has_future_reservations')
    sql(f"SELECT cancel_booking('{booked}',NULL,true);")
    configure(active=False)
    rental(cage="'R2'", fail='resource_policy_required')
    configure(purpose='rental')
    sql(f"SELECT create_staff_walkin('{kid}','{location}','{rental_type}',NULL,NULL,'{uuid.uuid4()}');", fail='rental_cage_required')

    # Parent/public callers need no named cage: the server allocates one
    # under the same resource and capacity lock, and deducts credits once.
    sql("INSERT INTO coach_availability(coach_id,tenant_id,day_of_week,start_time,end_time,location_id)"
        f" VALUES('50000000-0000-0000-0000-000000000002','{tenant}',"
        "extract(dow FROM '2103-05-08'::date)::int,'00:00','23:59','20000000-0000-0000-0000-000000000002');")
    key = str(uuid.uuid4())
    customer = f"SELECT create_customer_booking('{kid}','{location}','{rental_type}','2103-05-08 10:00Z','{key}','50000000-0000-0000-0000-000000000002');"
    result = json.loads(sql(customer, role='parent', user='90000000-0000-0000-0000-000000000003'))
    assert result == json.loads(sql(customer, role='parent', user='90000000-0000-0000-0000-000000000003'))
    assert result['booking']['cage_number'] is not None
    assert result['booking']['coach_id'] == '50000000-0000-0000-0000-000000000001'
    assert sql(f"SELECT purpose IN ('rental','both') FROM scheduling_resources WHERE location_id='{location}'"
               f" AND cage_number='{result['booking']['cage_number']}';") == 't'
    create(start='2103-06-01 10:00Z', end='2103-06-01 11:00Z', cage="'1'")
    before = int(sql("SELECT sessions_remaining FROM memberships LIMIT 1;"))
    def race(_):
        statement = f"SELECT create_customer_booking('{kid}','{location}','{rental_type}','2103-06-01 10:00Z','{uuid.uuid4()}');"
        try:
            return json.loads(sql(statement, role='parent', user='90000000-0000-0000-0000-000000000003'))
        except AssertionError as error:
            assert 'rental_resource_not_available' in str(error) or 'slot_not_available' in str(error)
            return None
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        winners = list(pool.map(race, range(2)))
    assert sum(winner is not None for winner in winners) == 1
    assert next(w for w in winners if w)['booking']['cage_number'] == 'R2'
    assert int(sql("SELECT sessions_remaining FROM memberships LIMIT 1;")) == before - 1
    public_id = sql(f"SELECT booking_id FROM create_public_booking('one',NULL,'{location}','{rental_type}',"
                    f"'{kid}','2103-07-01 10:00Z','{uuid.uuid4()}');", role='parent', user='90000000-0000-0000-0000-000000000003')
    assert public_id
    assert sql(f"SELECT cage_number IS NOT NULL FROM bookings WHERE id='{public_id}';") == 't'
    assert sql("SELECT has_table_privilege('authenticated','scheduling_resources','UPDATE');") == 'f'
    print('PASS: resource owner scope/audit/retirement, required rental cages, customer/public allocation and concurrent final-cage credit safety')
