"""Existing waitlist/cancellation contracts through the shared booking guards."""
import concurrent.futures
import json
import uuid


def run_waitlist_tests(sql, create, tenant, location, kid):
    parent = '90000000-0000-0000-0000-000000000003'
    family = '30000000-0000-0000-0000-000000000001'
    coach = '50000000-0000-0000-0000-000000000001'
    rental = '60000000-0000-0000-0000-000000000002'
    private = '60000000-0000-0000-0000-000000000001'
    sql("UPDATE memberships SET sessions_remaining=30;")
    sql(f"UPDATE session_types SET capacity=2 WHERE id='{rental}';")

    def offer(start, end, deadline="now()+interval '2 hours'", session_type=rental):
        return sql(f"INSERT INTO booking_waitlist(tenant_id,session_slot_key,kid_id,family_id,coach_id,session_type_id,"
                   f"location_id,scheduled_start,scheduled_end,position,status,claim_deadline) VALUES('{tenant}','{uuid.uuid4()}',"
                   f"'{kid}','{family}','{coach}','{session_type}','{location}','{start}','{end}',1,'notified',{deadline}) RETURNING id;")

    def claim(entry, **kwargs):
        return json.loads(sql(f"SET ROLE authenticated; SELECT claim_waitlist_spot('{entry}');", role='parent', user=parent, **kwargs) or 'null')

    offered = offer('2105-05-01 10:00Z', '2105-05-01 11:00Z')
    assert json.loads(sql(f"SELECT claim_waitlist_spot('{offered}');"))['code'] == 'NOT_FOUND'
    assert claim(offered, tenant='10000000-0000-0000-0000-000000000002')['code'] == 'NOT_FOUND'
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        replays = list(pool.map(lambda _: claim(offered), range(2)))
    assert replays[0] == replays[1] and replays[0]['code'] == 'OK'
    booked = replays[0]['booking_id']
    assert sql(f"SELECT cage_number IS NOT NULL AND attended_at IS NULL FROM bookings WHERE id='{booked}';") == 't'
    assert sql("SELECT sessions_remaining FROM memberships LIMIT 1;") == '29'
    assert sql(f"SELECT claimed_booking_id='{booked}' AND status='claimed' FROM booking_waitlist WHERE id='{offered}';") == 't'
    expired = offer('2105-05-02 10:00Z', '2105-05-02 11:00Z', "now()-interval '1 minute'")
    assert claim(expired)['code'] == 'CLAIM_EXPIRED'
    assert sql(f"SELECT status FROM booking_waitlist WHERE id='{expired}';") == 'expired'
    unpaid = offer('2105-05-03 10:00Z', '2105-05-03 11:00Z')
    sql("UPDATE memberships SET sessions_remaining=0;")
    claim(unpaid, fail='no_session_credits')
    assert sql(f"SELECT status='notified' AND claimed_booking_id IS NULL FROM booking_waitlist WHERE id='{unpaid}';") == 't'
    assert sql("SELECT count(*) FROM bookings WHERE scheduled_start='2105-05-03 10:00Z';") == '0'
    sql("UPDATE memberships SET sessions_remaining=30;")
    sql(f"SELECT set_booking_capacity_override('{location}','rental','2105-05-04 10:00Z',"
        "'2105-05-04 11:00Z',1,'Explicit final-slot waitlist fixture');")
    contender = offer('2105-05-04 10:00Z', '2105-05-04 11:00Z')
    def race(kind):
        try:
            if kind == 'claim':
                return claim(contender)
            return json.loads(sql(f"SET ROLE authenticated; SELECT create_customer_booking('{kid}','{location}','{rental}',"
                                  f"'2105-05-04 10:00Z','{uuid.uuid4()}');", role='parent', user=parent))
        except AssertionError as error:
            assert 'slot_not_available' in str(error) or 'rental_resource_not_available' in str(error)
            return None
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        winners = list(pool.map(race, ['claim', 'customer']))
    assert sum(winner is not None for winner in winners) == 1
    assert sql("SELECT sessions_remaining FROM memberships LIMIT 1;") == '29'
    assert sql("SELECT count(*) FROM bookings WHERE scheduled_start='2105-05-04 10:00Z' AND status='confirmed';") == '1'

    near = sql(f"SELECT create_staff_booking('{kid}','{location}','{private}',now()+interval '12 hours',"
               f"now()+interval '13 hours',NULL,NULL,NULL,'{uuid.uuid4()}')->>'id';")
    late = json.loads(sql(f"SET ROLE authenticated; SELECT cancel_booking('{near}');", role='parent', user=parent))
    assert late['code'] == 'LATE_CANCEL'
    sql(f"UPDATE bookings SET status='cancelled' WHERE id='{near}';", role='parent', user=parent, fail='cancellation_rpc_required')
    sql(f"SET ROLE authenticated; UPDATE bookings SET status='cancelled' WHERE id='{near}';", role='parent', user=parent, fail='permission denied')
    assert sql(f"SELECT status FROM bookings WHERE id='{near}';") == 'confirmed'
    sql(f"SET ROLE authenticated; SELECT cancel_booking('{near}','Staff override fixture',true);")
    assert sql(f"SELECT status FROM bookings WHERE id='{near}';") == 'cancelled'
    assert sql("SELECT has_table_privilege('authenticated','bookings','INSERT');") == 'f'
    assert sql("SELECT has_table_privilege('authenticated','bookings','UPDATE');") == 'f'
    assert sql("SELECT has_function_privilege('authenticated','cancel_booking_authorized_internal(uuid,text,boolean)','EXECUTE');") == 'f'
    print('PASS: waitlist authorized replay, rental resource allocation, credit rollback/final-slot race, expiration and cancellation-policy cutover')
