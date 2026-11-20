---
name: Supabase auth callback locking
description: Why notification registration must not be awaited inside an auth-state subscriber
---

Keep Supabase auth-state subscribers synchronous. Defer any work that reads the session, including push-token registration, until after the callback returns.

**Why:** Supabase awaits subscribers while holding its session lock. A subscriber that awaits push registration can deadlock when that registration calls `auth.getSession()`. The UI may already show a signed-in user while later permission refreshes remain stuck.

**How to apply:** Schedule session-dependent work on a later event-loop turn, handle its errors separately, and avoid repeating push registration on `TOKEN_REFRESHED`. Preserve a regression check that models the held auth lock. Do not log session or push tokens.
