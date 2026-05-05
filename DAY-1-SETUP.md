# Day 1 Setup Guide (Replit Edition)

> Follow this step-by-step. Estimated time: 75-100 minutes.

---

## Before You Start

### Required accounts
- [ ] Replit (replit.com) — Core or Teams plan recommended
- [ ] GitHub (for backup and code review)
- [ ] Supabase (free tier — supabase.com)
- [ ] Expo (free — expo.dev)
- [ ] Stripe (test mode is fine for v0.1) — defer until v0.5
- [ ] Mux (account creation) — defer until v0.4

### Required mobile app
- [ ] Expo Go on your iPhone or Android (App Store / Play Store)

### Optional but recommended
- [ ] PostgreSQL Mac app (for inspecting DB)
- [ ] Stripe CLI (for testing webhooks locally)

---

## Step 1: Create the Replit project (10 min)

1. Go to replit.com → Create Repl
2. Choose template: **Search for "Expo" template** OR start with "Node.js"
3. Name it: `ballpark-app`
4. Set as Private
5. Click "Create Repl"

If using Teams plan:
- Add team members as collaborators (Invite from sidebar)
- Confirm everyone has access before continuing

---

## Step 2: Connect to GitHub (10 min)

In the Replit workspace:

1. Click **Tools → Git** in the sidebar
2. Click "Connect to GitHub"
3. Authorize Replit if needed
4. Click "Create a GitHub Repository" → name it `ballpark-app`
5. Set as Private
6. Confirm the connection works

This is critical — Git on GitHub is your real backup. Don't rely on Replit's auto-save.

---

## Step 3: Drop in this handoff package (10 min)

You should have received a zip file with:
- `CLAUDE.md`
- `README.md`
- `DAY-1-SETUP.md` (this file)
- `.replit` and `replit.nix`
- `.gitignore`
- `.env.example`
- `/docs` (5 markdown files)
- `/design` (3 JSX prototype files + README)

To upload to Replit:

**Option A: Upload via Replit UI**
1. In the file tree, right-click → Upload File / Folder
2. Drop in each file/folder

**Option B: Upload via Git** (faster if you're comfortable)
1. In the Replit shell:
```bash
# Initialize Git locally first if needed
git init
git remote add origin https://github.com/YOUR_USERNAME/ballpark-app.git
```
2. Drop the zip contents into the Replit workspace
3. ```bash
   git add .
   git commit -m "chore: initial documentation and prototype handoff"
   git push -u origin main
   ```

---

## Step 4: Create Supabase project (10 min)

1. Go to supabase.com → New Project
2. Project name: `ballpark-app`
3. Database password: save it in 1Password / your password manager
4. Region: pick closest to your users (US East for Texas-based franchise)
5. Wait for provisioning (~2 minutes)
6. Once ready, go to **Project Settings → API**
7. Copy these two values (you'll need them in Step 5):
   - Project URL
   - Anon (public) key

---

## Step 5: Configure Replit Secrets (5 min)

In the Replit workspace:

1. Click **Tools → Secrets** in the sidebar
2. Add these secrets one at a time:

| Key | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | (from Supabase, Step 4) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase, Step 4) |
| `EXPO_PUBLIC_TENANT_SLUG` | `infinitehitting` |

These secrets are now available to all workspace developers via `process.env.EXPO_PUBLIC_SUPABASE_URL` etc.

---

## Step 6: Open in Replit and load context (10 min)

In the Replit workspace, you should see your file tree.

Open Replit Agent (sidebar):

```
Read CLAUDE.md, docs/PRD.md, docs/DESIGN.md, docs/ARCHITECTURE.md,
docs/ROADMAP.md, docs/PROMPTS.md.

Don't write any code yet. Briefly tell me:
1. What's the project?
2. What's our tech stack?
3. What are we building first (v0.1)?
4. What can you tell me about the visual design system?
```

Replit Agent will respond with its understanding. Read it carefully.

**If the response is accurate:** Continue to Step 7.

**If the response is wrong or confused:**
- Identify which doc was unclear
- Edit that doc to clarify
- Run the validation prompt again

This 10 minutes of validation saves hours of bad code.

---

## Step 7: Bootstrap the Expo project (30 min)

In Replit Agent, paste this:

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

Replit Agent will create the project. May take a few minutes.

---

## Step 8: Run the app on your phone (10 min)

In the Replit shell, run:

```bash
npx expo start --tunnel
```

You should see a QR code in the terminal AND in the Replit webview.

On your iPhone:
1. Open Expo Go app
2. Tap "Scan QR Code"
3. Point at the QR code in Replit
4. Wait 30-60 seconds for the app to load (tunnel mode is slower than LAN)

You'll see the default Expo template — that's expected for now.

**Troubleshooting:**

- **"Network response timed out"** — Tunnel mode requires internet on phone. Check WiFi/cellular.
- **"Something went wrong"** — Restart the dev server: Ctrl+C, then `npx expo start --tunnel --clear`
- **App loads but shows red error** — Read the error, paste into Claude Code or Replit Agent for help.

---

## Step 9: Refine with Claude Code (15 min)

Open the Replit shell. Install Claude Code CLI:

```bash
npm install -g @anthropic-ai/claude-code
```

Then run Claude Code in the project root:

```bash
claude-code
```

Claude Code will start. Paste this:

```
Read CLAUDE.md. Open the project we just bootstrapped via Replit Agent
and verify:

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

Claude Code will polish the scaffolding. Review its changes before approving.

---

## Step 10: Commit and push (5 min)

In the Replit shell:

```bash
git add -A
git commit -m "feat: initial Expo project scaffolding (v0.1)"
git push
```

Verify the push went through to GitHub. You should see all the files in your GitHub repo.

You're done with Day 1. 🎉

---

## What Tomorrow Looks Like

Continue with `docs/PROMPTS.md` Step 1.4 onward:

1. **Replit Agent** → Set up Replit Secrets verification
2. **Claude Code** → Theme tokens (colors, fonts, spacing)
3. **Replit Agent** → Initialize Supabase locally and link
4. **Claude Code** → Write the initial schema migration
5. **Replit Agent** → Push schema to Supabase
6. **Claude Code** → Build Supabase client + auth hooks
7. **Replit Agent** → Scaffold auth screens
8. **Claude Code** → Polish auth screens to match design
9. **Replit Agent** → Build navigation + bottom nav
10. **Claude Code** → Final polish + v0.1 validation

Expected timeline:

| Day | Milestone |
|---|---|
| 1 (today) | Project scaffolded, Expo running on phone |
| 2 | Theme tokens loaded, fonts working |
| 3 | Supabase schema deployed, auth working |
| 4 | Auth screens polished |
| 5 | Bottom nav with placeholders, v0.1 complete |
| **End of Week 1** | **v0.1 done, ready for v0.2** |
| Weeks 2-3 | v0.2 — Home tab |
| Weeks 4-5 | v0.3 — Booking system |
| Weeks 6-7 | v0.4 — Messages + Mux |
| Weeks 8-10 | v0.5 — Earn + Stripe |

By end of Week 10, you have a working pilot-ready app.

---

## Common Issues

### "Replit Agent isn't seeing CLAUDE.md"

In some Replit Agent versions, you need to explicitly reference files:
```
@CLAUDE.md @docs/PRD.md @docs/ROADMAP.md

Now build [feature].
```

### "Expo Go shows error about incompatible SDK"

Update Expo Go on your phone, or downgrade `expo` in `package.json` to match.

### "Tunnel mode is super slow"

This is normal but annoying. Options:
- Accept it (that's Replit + RN reality)
- Switch to LAN mode if phone is on same network as Replit (rarely works)
- For visual review only: use Expo's web preview (`npx expo start --web`) — works for layout, not native features

### "Supabase migration fails"

```bash
# Verify project link
npx supabase status

# Re-link if needed
npx supabase link --project-ref YOUR_PROJECT_REF

# Then push
npx supabase db push
```

### "TypeScript errors after install"

```bash
rm -rf node_modules package-lock.json
npm install
npx supabase gen types typescript --linked > src/types/database.ts
npm run typecheck
```

### "Replit's container ran out of memory"

Restart the Repl. If recurring, upgrade to a higher tier.

---

## Habits to Build From Day 1

1. **Always work in feature branches** for non-trivial changes
2. **Commit after every working state** (don't accumulate unsaved changes)
3. **Push to GitHub at the end of every session** (don't trust Replit alone)
4. **Run typecheck before committing** (`npm run typecheck`)
5. **End sessions cleanly** (commit, push, close terminal)
6. **Read the docs when stuck** before asking the AI tools
7. **Update docs when you make decisions** (so they're locked for next time)
8. **Coordinate with team** before running the dev server (only one at a time)

---

## When You're Stuck

1. Re-read the relevant doc
2. Check `/docs/PROMPTS.md` for similar patterns
3. Try the validation prompt to refresh context
4. Switch tools — if Replit Agent is confused, try Claude Code, and vice versa
5. Ask the human (back here in claude.ai) for help

---

## You're Ready

Hit Step 1. By tonight you'll have an Expo app on your phone with the project structured exactly the way it needs to be for the next 10 weeks of work.

Don't perfect anything. Ship the slices. The prototype is your visual North Star — match it pixel-by-pixel and trust the framework.

Let's build.
