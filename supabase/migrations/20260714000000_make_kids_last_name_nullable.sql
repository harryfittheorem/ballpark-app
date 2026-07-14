-- Migration: make kids.last_name nullable
-- kids.last_name was NOT NULL in the initial schema but the enrollment UI
-- treats it as optional. Dropping the constraint lets the portal enroll an
-- athlete with only a first name without hitting a DB constraint violation.
ALTER TABLE kids ALTER COLUMN last_name DROP NOT NULL;
