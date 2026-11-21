---
name: Preview build isolation
description: Why post-merge builds must not share output with the running portal preview
---

Keep development output separate from production build output, and restrict cleanup to the output being rebuilt.

**Why:** Post-merge setup runs while existing workflows can still be serving requests; reconciliation restarts them only afterward. Deleting a running Next.js server's generated output can cause missing-manifest and webpack-cache errors. A later restart can hide this conflict, so a healthy initial request does not disprove it.

**How to apply:** When changing build configuration or merge setup, verify a production build alongside the development server and check that login resources still load. Keep production build and start on the same output directory. Do not run the full merge script just to test the portal build: it also changes remote databases and deploys edge functions.
