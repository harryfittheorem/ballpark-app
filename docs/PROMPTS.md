# Prompt Library: Replit Agent + Claude Code

> Two AI tools, one project. This document explains when to use which and gives copy-paste prompts for each phase.

---

## The Dual-Tool Strategy

You have access to two AI assistants in Replit:

### Replit Agent (in the sidebar)
**Strengths:** Fast scaffolding, tight integration, runs commands, knows Replit's environment
**Weaknesses:** Less precise about following docs, sometimes makes architectural choices on the fly
**Use for:** Big setup tasks, installing packages, creating folder structures, running commands

### Claude Code (in the terminal)
**Strengths:** Reads docs carefully, follows conventions, polishes code, great at refactoring
**Weaknesses:** Slower, requires explicit context, doesn't run commands automatically
**Use for:** Implementing features per spec, refining code quality, matching design pixel-perfect

### The Pattern: Skeleton then Polish

```
Replit Agent → creates the rough structure
Claude Code → refines it to production quality
```

Don't have both editing the same file at the same time. Coordinate.

---

## Validation Prompts (run BEFORE work)

### Replit Agent validation prompt

```
Read CLAUDE.md, docs/PRD.md, docs/DESIGN.md, docs/ARCHITECTURE.md,
docs/ROADMAP.md.

Don't write any code yet. Briefly tell me:
1. What's the project?
2. What's our tech stack?
3. What are we building first (v0.1)?
4. What can you tell me about the visual design system?
```

### Claude Code validation prompt (in terminal)

```
Read CLAUDE.md, docs/PRD.md, docs/DESIGN.md, docs/ARCHITECTURE.md,
docs/ROADMAP.md.

Don't write any code yet. Tell me:
1. What you understand the project to be (3 sentences)
2. The locked tech stack
3. What we're building first (v0.1 specifically)
4. The 5 bottom nav tabs we're targeting
5. Any contradictions or unclear areas in the docs
6. Any questions you have before we start

This is a context-check, not a planning session. Just verify
you've absorbed everything correctly.
```

---

## v0.1 Prompts: Foundation & Auth

### Step 1.1 (Replit Agent) — Bootstrap the project

```
We're building a React Native + Expo app called Ballpark. Read CLAUDE.md
and docs/ARCHITECTURE.md first.

I want you to:
1. Initialize a fresh Expo project with TypeScript template in the
   current Replit workspace
2. Install these dependencies:
   - @supabase/supabase-js
   - @tanstack/react-query
   - zustand
   - react-hook-form, zod, @hookform/resolvers
   - react-native-svg, lucide-react-native
   - expo-secure-store, expo-haptics, expo-font
   - @react-navigation/native, @react-navigation/native-stack, @react-navigation/bottom-tabs
   - @expo-google-fonts/oswald, @expo-google-fonts/inter
   - expo-linear-gradient
3. Create the folder structure exactly as in ARCHITECTURE.md section 9
4. Configure path aliases in tsconfig.json and babel.config.js:
   @/components, @/screens, @/api, @/theme, @/hooks, @/lib, @/store,
   @/utils, @/types
5. Set TypeScript to strict mode

After: show me the folder tree and tell me how to run dev with tunnel.
```

### Step 1.2 (Claude Code in terminal) — Refine the scaffolding

```
Open the project we just bootstrapped. Read CLAUDE.md and verify:

1. tsconfig.json has strict mode, all path aliases configured
2. babel.config.js has matching path resolver
3. Folder structure matches ARCHITECTURE.md section 9 exactly
4. package.json scripts include:
   - dev: "expo start --tunnel"
   - typecheck: "tsc --noEmit"
   - lint: "eslint . --ext .ts,.tsx"
5. ESLint config exists with TypeScript rules

If anything is wrong or missing, fix it. Don't add features yet.
Run typecheck at the end to verify everything is clean.
```

### Step 1.3 (Replit Agent) — Configure Replit Secrets

```
Help me set up environment variables for the project.

The app needs:
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_TENANT_SLUG (set to: infinitehitting)

Show me how to add these via Replit's Secrets panel, and verify the
app can read them via process.env.EXPO_PUBLIC_SUPABASE_URL.

(I'll get the actual Supabase keys from the Supabase dashboard.)
```

### Step 1.4 (Claude Code) — Theme tokens

```
Read docs/DESIGN.md sections 2 (colors), 3 (typography), 4 (spacing),
5 (border radius).

Create:
1. /src/theme/tokens.ts with colors, spacing, radius, fonts, fontSizes,
   fontWeights — values exactly from DESIGN.md
2. /src/theme/fonts.ts that loads Oswald and Inter via expo-font
3. /src/theme/index.ts that exports everything

Then update App.tsx to:
1. Use useFonts hook to load both font families
2. Show splash/loading until fonts ready
3. Render placeholder text "Ballpark" in Oswald 32pt gold on dark
   to verify fonts load correctly

Run typecheck. Show me the code before I test on phone.
```

### Step 1.5 (Replit Agent) — Supabase project setup

```
We need to set up Supabase. Help me:

1. Initialize Supabase in the project: `npx supabase init`
2. After I create the Supabase project in their dashboard, link it:
   `npx supabase link --project-ref <ref-from-dashboard>`
3. Create our first migration: `npx supabase migration new initial_schema`

After step 3, show me where the migration file was created so I can
hand it to Claude Code for the actual SQL.
```

### Step 1.6 (Claude Code) — Initial schema and RLS

```
Read docs/PRD.md section 5 (data model) and docs/ARCHITECTURE.md
section 11 (RLS patterns).

Open the migration file at supabase/migrations/<timestamp>_initial_schema.sql
and write SQL for:

1. Tables:
   - tenants (with brand_colors, brand_logo_url, stripe_account_id)
   - locations
   - families (with parent_user_id linking to auth.users)
   - kids (with points_balance, current_streak_days)
   - coaches

2. RLS policies for each table per ARCHITECTURE.md patterns:
   - Tenant isolation
   - Family can see own data
   - Coach can see location-level data

3. A trigger function `handle_new_user()` that:
   - On INSERT into auth.users
   - Creates a row in `families` with parent_user_id = NEW.id
   - Adds JWT custom claims for tenant_id, family_id, role

4. Seed file at supabase/seed/seed.sql:
   - 1 tenant: Infinite Hitting (slug: 'infinitehitting')
   - 1 location: Dallas N.
   - 1 coach: Coach Mike

Use UUIDs for IDs, timestamps with timezone.
Show me the SQL before pushing — I'll review.
```

### Step 1.7 (Replit Agent) — Push schema

```
The migration is reviewed and ready. Push it to Supabase:

`npx supabase db push`

Then generate TypeScript types:

`npx supabase gen types typescript --linked > src/types/database.ts`

Show me the generated types and confirm they match what we expect.
```

### Step 1.7a — Register the Custom Access Token Hook (per-tenant, REQUIRED)

> **Required for every new tenant deployment.** The local `supabase/config.toml`
> `[auth.hook.custom_access_token]` block does **not** propagate to hosted
> Supabase via `supabase db push`. Until the hook is enabled in the dashboard,
> JWTs will not carry `tenant_id` / `family_id` / `role`, and every RLS policy
> that depends on those claims will silently deny rows.

**Option A — Dashboard (recommended for humans):**
1. Open the project in the Supabase dashboard.
2. **Authentication → Hooks** (sidebar).
3. Find **Custom Access Token** and click **Enable**.
4. Set **Hook type:** Postgres function · **Schema:** `public` · **Function:** `custom_access_token_hook`.
5. Save.

**Option B — Management API (scriptable, used by Replit Agent):**

```bash
curl -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hook_custom_access_token_enabled": true,
       "hook_custom_access_token_uri": "pg-functions://postgres/public/custom_access_token_hook"}' \
  "https://api.supabase.com/v1/projects/<project-ref>/config/auth"
```

Verify enablement:

```bash
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/<project-ref>/config/auth" \
  | grep -E 'hook_custom_access_token_(enabled|uri)'
```

Expected: `"hook_custom_access_token_enabled": true` and the `pg-functions://postgres/public/custom_access_token_hook` URI.

**End-to-end smoke test (proves the hook + `handle_new_user` trigger both fire):**

Once you have a valid `EXPO_PUBLIC_SUPABASE_ANON_KEY` in env, run:

```
node scripts/verify-auth-hook.mjs
```

Expected tail:

```
-> JWT custom claims: { "tenant_id": "...", "family_id": "...", "role": "parent" }
PASS: tenant_id, family_id, role all present on the issued JWT.
```

If the project has email confirmations enabled (`mailer_autoconfirm: false`),
the script may not get a session token from `signup` and will try `signinWithPassword`,
which fails until the test user is confirmed. In that case verify directly via
the database (mgmt API SQL or psql):

```sql
-- Drop-in standalone verification: creates a synthetic user, runs the hook,
-- cleans up, returns the resulting claims.
CREATE OR REPLACE FUNCTION public._verify_hook_test() RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_email text := 'hookprobe_'||substr(md5(random()::text),1,8)||'@example.com';
  v_tid uuid; v_fid uuid; v_event jsonb; v_result jsonb;
BEGIN
  SELECT id INTO v_tid FROM public.tenants WHERE slug='infinitehitting';
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, '', '{}'::jsonb, jsonb_build_object('tenant_slug','infinitehitting'),
      now(), now(), '', '', '', '');
  SELECT id INTO v_fid FROM public.families WHERE parent_user_id=v_uid;
  v_event := jsonb_build_object('user_id', v_uid::text,
    'claims', jsonb_build_object('sub', v_uid::text, 'email', v_email,
      'aud','authenticated','role','authenticated'));
  v_result := public.custom_access_token_hook(v_event);
  DELETE FROM auth.users WHERE id=v_uid;
  RETURN jsonb_build_object('expected_tenant_id', v_tid,
    'expected_family_id', v_fid, 'hook_claims', v_result->'claims');
END $f$;
SELECT public._verify_hook_test();
DROP FUNCTION public._verify_hook_test();
```

`hook_claims` should include `tenant_id`, `family_id`, and `role: "parent"`,
and `family_id` should equal `expected_family_id` (proving `handle_new_user`
auto-created the family row).

### Step 1.8 (Claude Code) — Supabase client + auth hooks

```
Read docs/ARCHITECTURE.md sections 4 (auth) and 10 (env vars).

Create:

1. /src/lib/supabase.ts:
   - Import @supabase/supabase-js
   - Read env vars
   - Configure client with expo-secure-store for session persistence
   - Auto-refresh sessions
   - Export typed client

2. /src/hooks/useAuth.ts:
   - session, user, isLoading
   - signIn(email, password)
   - signUp(email, password, parentInfo)
   - signOut()
   - addKid(kidData)
   - Use TanStack Query for mutations

Run typecheck. Show me the code.
```

### Step 1.9 (Replit Agent) — Auth screens scaffold

```
Read docs/DESIGN.md (component patterns).

Create three auth screens in /src/screens/Auth/:
1. SignInScreen.tsx — email + password fields, sign in button
2. SignUpScreen.tsx — first name, last name, email, password, phone
3. AddKidScreen.tsx — first name, last name, age group, primary position

Use React Hook Form + Zod for validation.
Use design tokens from /src/theme/tokens.ts.

Match the dark + gold aesthetic.
Make them functional but ugly — Claude Code will polish next.
```

### Step 1.10 (Claude Code) — Polish auth screens

```
Read docs/DESIGN.md component patterns section.
The auth screens just got scaffolded but need design polish.

Refine SignInScreen, SignUpScreen, AddKidScreen to:

1. Use design tokens for ALL styling — no hardcoded values
2. Match the dark + gold aesthetic from /design/InfiniteHittingApp.jsx
3. Section labels in Oswald, uppercase, gold
4. Inputs styled to match the dark theme
5. Primary button (gold bg, dark text, Oswald, uppercase)
6. Secondary text/links in muted color
7. Inline validation errors in danger color
8. Loading state on submit button
9. Error toast on failed auth

Build any missing reusable components in /src/components/ui/:
- <Input> (with label, error display, secure mode)
- <Button> (primary and secondary)
- <PickerField>

Run typecheck. Show me the code before I test.
```

### Step 1.11 (Replit Agent) — Navigation + bottom nav

```
Read docs/DESIGN.md section 6 (Bottom Nav Tab pattern) and reference
/design/InfiniteHittingApp.jsx BottomNav component.

Create:
1. /src/navigation/RootNavigator.tsx
   - Decides between Auth and Main based on session from useAuth
   - Shows splash while loading

2. /src/navigation/AuthNavigator.tsx
   - Stack with SignIn, SignUp, AddKid

3. /src/navigation/MainTabNavigator.tsx
   - 5 tabs: Home, Work, Book, Earn, Me
   - Custom tab bar styled per DESIGN.md
   - Icons from lucide-react-native: Home, Briefcase, Calendar, Sparkles, User

4. Placeholder screens in /src/screens/{Home,Work,Book,Earn,Me}/:
   - Each has a header with preheader gold label + title in Oswald
   - "Coming soon" body text
   - Use design tokens

Update App.tsx to use RootNavigator inside QueryClientProvider.
```

### Step 1.12 (Claude Code) — Polish nav + final v0.1 review

```
Read CLAUDE.md and docs/ROADMAP.md v0.1 definition of done.

Open the navigation files and placeholder screens. Polish them:

1. BottomNav matches the prototype exactly:
   - Background: rgba(28, 27, 26, 0.95)
   - Backdrop blur via expo-blur BlurView
   - Border-top: colors.border
   - Padding: 10px 8px 24px (extra bottom for safe area)
   - Active state: gold + 2.5 stroke
   - Inactive state: muted + 2 stroke

2. Placeholder screens all use design tokens

3. Run typecheck — must be zero errors
4. Run lint — must be zero warnings

When done, run through the v0.1 definition of done checklist
and tell me which items are complete vs incomplete.
```

---

## v0.2 - v0.5 Prompts

The pattern continues: Replit Agent for scaffolding, Claude Code for refinement.

For brevity, I won't repeat every prompt here — but use this template for each new feature:

### Template: New feature

**Replit Agent (scaffold):**
```
Read CLAUDE.md and docs/ROADMAP.md v0.X section.

Build the [feature] following the build order in ROADMAP.md:
1. Write migration: [tables]
2. Add RLS policies
3. Create API functions in /src/api/[file].ts
4. Build screen at /src/screens/[Screen]/

Reference /design/InfiniteHittingApp.jsx for visual structure.
Make it functional but rough — quality polish comes next.
```

**Claude Code (polish):**
```
Read docs/DESIGN.md and /design/InfiniteHittingApp.jsx [Component].

The [feature] was just scaffolded. Refine it to:
1. Match the prototype pixel-for-pixel
2. Use design tokens for all styling
3. Follow conventions in CLAUDE.md
4. Type everything strictly (no any)
5. Handle loading and error states

Run typecheck and lint before declaring done.
Show me the diff for review.
```

---

## Recurring Prompts

### Refactor pattern (Claude Code)

```
Refactor /src/screens/[X]/[Y].tsx to:
1. Use design tokens instead of inline values
2. Extract repeated patterns into reusable components in /src/components
3. Move type definitions to types.ts
4. Keep the visual output identical (verify on Expo Go)

Show me the diff. Don't rewrite everything — minimal changes.
```

### Bug fix pattern (Claude Code preferred)

```
I'm seeing [bug description].

Steps to reproduce:
1. ...
2. ...
3. ...

Expected: [what should happen]
Actual: [what happens]

Investigate, identify root cause, propose fix. Don't write code
until I approve the diagnosis.
```

### Adding a new feature (Claude Code)

```
I want to add [feature].

Read the relevant docs. Then:
1. Explain how it fits into existing architecture
2. List the changes needed (DB, API, UI)
3. Identify any decisions I need to make
4. Wait for my approval before writing code

Use planning mode.
```

### Context refresh — start of new session

```
We're continuing the Ballpark build. Read CLAUDE.md and the
relevant section of docs/ROADMAP.md for the current version.

Last completed: [feature X]
Now starting: [feature Y]

Verify your understanding before we begin.
```

### Pre-commit check (run before every commit)

```
Run typecheck. Run lint. Tell me everything that fails.
Don't fix yet — just report.
```

---

## Replit-Specific Workflow Patterns

### "Multiple devs in workspace" coordination

If a teammate is in the workspace, before starting a major change:

```
Check if anyone else is editing files I'm about to change.
Look at recent saves in the workspace. Tell me if you see active
work in: [list of files I'll touch].
```

### "Test on my phone via tunnel"

```
Start the dev server in tunnel mode: `npx expo start --tunnel`
When ready, give me the QR code URL so I can scan it from
Expo Go on my phone.
```

### "Coordinate with Replit Agent"

When Claude Code is about to do something Replit Agent would handle better:

```
This is a packaging/install task that Replit Agent does well.
Stop. Let me hand this off to Replit Agent and come back to you
for the implementation.
```

### "Edge function deployment"

Edge functions deploy to Supabase, not Replit:

```
This edge function needs to be deployed to Supabase. Don't try
to run it in Replit. Run:
`npx supabase functions deploy <function-name>`
And test it via the Supabase dashboard or curl.
```

---

## Anti-Patterns (don't do these)

### ❌ The "build the whole thing" prompt
Don't say: "Build the entire athlete app"
Do say: "Build the Home tab matching the prototype"

### ❌ The "just make it work" prompt
Don't say: "Get auth working"
Do say: "Build SignUp + SignIn + AddKid screens with the specific fields and validation rules from PRD section 3.1"

### ❌ The "you decide" prompt
Don't say: "Pick the best state management library"
Do say: "Use TanStack Query for server state and Zustand for client state, per ARCHITECTURE.md"

### ❌ The "remember our last conversation" prompt
Don't say: "Continue what we were doing"
Do say: "We just finished v0.2 Home tab. Now starting v0.3 booking. Read docs/ROADMAP.md v0.3 section."

### ❌ Mixing Agent and Claude Code on the same file
Don't have both AI tools editing the same file in parallel.
Do hand off cleanly: "Replit Agent built the skeleton, now Claude Code, refine it."

---

## When Things Go Wrong

### "The app won't load on my phone"

1. Confirm tunnel mode is on: `npx expo start --tunnel`
2. Check Replit's webview for the QR code (not just the terminal)
3. Make sure your phone has cellular or WiFi (tunnel works over either)
4. Try restarting the dev server: Ctrl+C, then `npm run dev`
5. Clear Expo Go cache: shake phone in Expo Go → "Clear cache"

### "TypeScript errors are everywhere"

1. Run `npx supabase gen types typescript --linked > src/types/database.ts`
2. Restart TypeScript server in your editor
3. Check that path aliases match in tsconfig and babel.config

### "Replit Agent is making things up"

1. Stop. Don't accept the output.
2. Tell it: "That conflicts with [doc]. Please re-read [doc] section X."
3. If pattern persists, switch to Claude Code for the task — it follows docs more carefully.

### "Replit is slow today"

1. Check Replit status page
2. Restart your Repl
3. Pull latest from GitHub fresh in case workspace state corrupted
4. As last resort, work locally for that session and push back to Replit

---

## Tips for Solo + Team-Joining-Later

When your team joins, do this:

1. **Lock the docs.** Once docs are final, they don't change without team agreement.
2. **Pair with new devs first.** Spend 1-2 hours walking them through CLAUDE.md and the prototype.
3. **Create branches per dev.** Don't all work on main.
4. **Use PRs even for solo work.** Builds the habit.
5. **Daily standup.** 5 min in Replit chat: what I did, what I'm doing, blockers.
6. **Don't over-divide work.** Until you have ≥3 devs, parallelization causes more conflicts than it saves time.
