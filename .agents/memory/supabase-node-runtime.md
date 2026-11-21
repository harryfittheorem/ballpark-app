---
name: Supabase on Node 20
description: Standalone acceptance scripts need explicit WebSocket transport on this runtime
---

On this project's Node 20 runtime, newer Supabase clients initialize their Realtime transport even for ordinary Auth/REST usage. Standalone scripts must supply the installed `ws` transport when creating a client.

**Why:** A development acceptance script failed immediately with “Node.js 20 detected without native WebSocket support” before any request or subscription.

**How to apply:** Pass `realtime: { transport: WebSocket }` in standalone Node client options. Do not change mobile transport or install another runtime merely to run an acceptance script.
