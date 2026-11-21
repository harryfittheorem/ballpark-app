---
name: Supabase standalone acceptance runtime
description: WebSocket transport and safe session handling for standalone authenticated browser checks
---

On this project's Node 20 runtime, newer Supabase clients initialize their Realtime transport even for ordinary Auth/REST usage. Standalone scripts must supply the installed `ws` transport when creating a client.

**Why:** A development acceptance script failed immediately with “Node.js 20 detected without native WebSocket support” before any request or subscription.

**How to apply:** Pass `realtime: { transport: WebSocket }` in standalone Node client options. Do not change mobile transport or install another runtime merely to run an acceptance script.

## Authenticated browser checks

Keep temporary session issuance, browser cookie injection and test-session-only
revocation in one process when the browser notebook cannot share shell-local
connections. Use the installed Supabase SSR cookie encoding and chunking
conventions, not one oversized raw auth cookie.

**Why:** Cross-runtime loopback/FIFO handoffs proved unreliable and lost
revocation credentials; large owner-session cookies also exceeded the browser's
single-cookie limit. A same-process walkthrough with correctly chunked cookies
worked without changing the account's password or role.

**How to apply:** Keep credentials and cookies in memory, close temporary
contexts and revoke only the issued test session in `finally`. Never use global
sign-out, dump browser auth state or revoke pre-existing user sessions to clean
up a walkthrough.
