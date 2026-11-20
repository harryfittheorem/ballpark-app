"""Resource-aware legacy rental entry points, using disposable fixtures only."""
import concurrent.futures
import json
import uuid


def run_friend_rental_tests(sql, tenant, location, kid):
    rental_type = '60000000-0000-0000-0000-000000000002'
    coach = '50000000-0000-0000-0000-000000000001'
    parent = '90000000-0000-0000-0000-000000000003'
    sql("UPDATE memberships SET sessions_remaining=30;")
    sql(f"SELECT set_manual_location_capacity('{location}',2,2);")

    def credits():
        return int(sql(f"SELECT sessions_remaining FROM memberships WHERE kid_id='{kid}' LIMIT 1;"))

    def points():
        return int(sql(f"SELECT points_balance FROM kids WHERE id='{kid}';"))

    def friend(day, key=None, **kwargs):
        key = key or str(uuid.uuid4())
        return json.loads(sql(
            f"SELECT book_session_with_friend('{tenant}','{location}','{kid}','{coach}','{rental_type}',"
            f"'2110-02-{day:02} 10:00Z','2110-02-{day:02} 11:00Z','Rental fixture friend',NULL,NULL,'{key}');",
            role='parent', user=parent, **kwargs) or '{}')

    def staff(day, key=None, **kwargs):
        key = key or str(uuid.uuid4())
        return sql(f"SELECT create_staff_booking('{kid}','{location}','{rental_type}',"
                   f"'2110-02-{day:02} 10:00Z','2110-02-{day:02} 11:00Z',NULL,'R2','Member detail fixture','{key}')->>'id';",
                   **kwargs)

    # The shared member-detail form supplies an explicit cage and keeps the
    # request nonce on retry, unlike the removed independent legacy modal.
    key = str(uuid.uuid4())
    before = credits()
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        rows = list(pool.map(lambda _: staff(1, key), range(2)))
    assert rows[0] == rows[1] and credits() == before - 1
    staff(1, fail='resource_not_available')
    assert credits() == before - 1

    # A replay race reserves exactly two distinct exclusive cages, charges
    # exactly two credits and awards the unchanged single friend bonus.
    key = str(uuid.uuid4())
    before, prior_points = credits(), points()
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        pair = list(pool.map(lambda _: friend(2, key), range(2)))
    assert pair[0] == pair[1] and credits() == before - 2
    assert points() == prior_points + 100
    ids = [pair[0]['primary_booking_id'], pair[0]['guest_booking_id']]
    assert ids[0] != ids[1]
    assert sql(f"SELECT count(DISTINCT cage_number) FROM bookings WHERE id IN('{ids[0]}','{ids[1]}');") == '2'
    assert sql(f"SELECT bool_and(attended_at IS NULL AND actual_coach_id IS NULL AND status='confirmed')"
               f" FROM bookings WHERE id IN('{ids[0]}','{ids[1]}');") == 't'
    assert sql(f"SELECT count(*) FROM booking_friend_requests WHERE request_id='{key}';") == '1'
    assert sql("SELECT current_setting('app.booking_friend_resources',true) IS DISTINCT FROM 'on';") == 't'

    # With only one free cage, the second insert must roll back the first
    # booking, both credits, the bonus and receipt, not leave half a pair.
    staff(3)
    sql(f"SELECT set_manual_location_capacity('{location}',2,4);")
    before, prior_points = credits(), points()
    key = str(uuid.uuid4())
    friend(3, key, fail='rental_resource_not_available')
    assert credits() == before and points() == prior_points
    assert sql("SELECT count(*) FROM bookings WHERE scheduled_start='2110-02-03 10:00Z';") == '1'
    assert sql(f"SELECT count(*) FROM booking_friend_requests WHERE request_id='{key}';") == '0'
    sql(f"SELECT set_manual_location_capacity('{location}',2,2);")

    # Competing ordinary and paired rentals cannot partially win or exceed
    # the same location/resource pool.
    before, prior_points = credits(), points()
    def contender(paired):
        try:
            return ('pair', friend(4)) if paired else ('single', staff(4))
        except AssertionError as error:
            assert any(message in str(error) for message in (
                'slot_not_available', 'resource_not_available', 'rental_resource_not_available'))
            return None
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        outcomes = list(pool.map(contender, [True, False]))
    winner = next(result for result in outcomes if result)
    assert sum(result is not None for result in outcomes) == 1
    count = 2 if winner[0] == 'pair' else 1
    assert credits() == before - count
    assert points() == prior_points + (100 if count == 2 else 0)
    assert int(sql("SELECT count(*) FROM bookings WHERE scheduled_start='2110-02-04 10:00Z';")) == count
    assert int(sql("SELECT count(DISTINCT cage_number) FROM bookings WHERE scheduled_start='2110-02-04 10:00Z';")) == count

    before = credits()
    sql(f"UPDATE memberships SET sessions_remaining=1 WHERE kid_id='{kid}';")
    friend(5, fail='no_session_credits')
    assert sql("SELECT count(*) FROM bookings WHERE scheduled_start='2110-02-05 10:00Z';") == '0'
    sql(f"UPDATE memberships SET sessions_remaining={before} WHERE kid_id='{kid}';")
    print('PASS: member-detail rental replay/resource failure; Bring-a-Friend rental cages, two credits, bonus/replay races, rollback and ordinary-booking competition')
