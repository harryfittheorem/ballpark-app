---
name: Isolated PostgreSQL lifecycle
description: Keep development rehearsal databases inside managed workflows, not detached one-off shells.
---

An isolated PostgreSQL rehearsal that must survive between browser/API requests
must run under a managed workflow with a foreground process kept alive. A
successful `pg_ctl start` from a one-off shell is not proof the database remains
available after that tool call.

**Why:** Process lifetime from a one-off tool is not guaranteed to extend to
later requests; a readiness result alone does not establish service lifetime.

**How to apply:** Use a managed rehearsal workflow and confirm the Unix socket
from a subsequent tool call before starting browser tests. Keep cluster files
under ignored generated output, separate from the shared Supabase target.
