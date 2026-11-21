# Web training delivery

The user approved a phase-by-phase web-only Trainual replacement within the current work.
No change to the native mobile app, no production publishing, no Trainual cancellation.

## Phases
- Foundation: tenant-isolated library, immutable published versions, private attachments, learner and manager access.
- Learning: pinned-version assignments, ordered paths, quizzes, acknowledgments, practical sign-off, reports.
- Migration tooling: explicit normalized manifest, dry run, original source preservation, reconciliation, duplicate-safe staging, guarded rollback.
- Client migration: requires authorized Trainual exports/API access, original videos, rights confirmation, and client reconciliation/sign-off.
- Cutover: requires client approval after pilot and final incremental reconciliation.

## Source decision
Client has Trainual Enterprise; the user selected manual uploads in the app or a Google Drive source
provided later. Manual upload is the primary workflow. Direct Drive copying is not connected:
registered links are blocked inventory references until authorized originals are uploaded.

## Delivery boundaries
Never imply a migration occurred without actual source data. A normalized manifest is not a universal
Trainual export parser. Imported historical evidence is kept separate from new in-app completions.
Role-based onboarding/refresher enrollment runs when a learner opens training; managers can explicitly
apply enabled rules to the current team. Reminders are due/overdue indicators in My Training, not
scheduled email or push messages. Published content remains immutable and historical evidence is not
represented as a native completion. Source files and content remain private to the business.

The initial editor supports a safe Markdown subset (headings, bold, lists, links, tables), not arbitrary
HTML. Uploads preserve originals (including Office files and ZIP archives) without automatically
extracting lessons. Native MP4/WebM playback requires a browser-compatible codec; there is no automatic
transcoding. Each file is capped at 250 MB, hashed server-side and exposed only through expiring URLs.

## Verification commands
From portal:
```
npm run typecheck
./node_modules/.bin/tsc --outDir /tmp/ballpark-training-tests --module commonjs --target es2022 --esModuleInterop --skipLibCheck lib/training/validation.test.ts lib/training/validation.ts lib/training/types.ts
node --test /tmp/ballpark-training-tests/validation.test.js
```
The rollback-only SQL assertions are in scripts/test-training-database.sql. Run against the configured
Supabase project with authorized management access; the script always rolls back its fixture changes.

## Subject/topic/step Trainual exports

The migration workspace now accepts the supplied JSON plus companion Markdown as a pair.
Original UTF-8 contents, filenames and SHA-256 checksums are retained in tenant-private batch
storage and downloadable by managers. Subjects become editable drafts; topics and lessons retain
their source ordering. Imported references are explicitly linked-only, with manager acknowledgment
required before import. Legacy file/video inventory still requires verified private assets.

The companion Markdown separates tests merged into lesson bodies in the JSON. Original bodies
are preserved and tests remain ungraded source content awaiting answer-key review. No answer keys,
learner history, publication or enrollment are inferred. See `trainual-import-reconciliation.md`.

Additional verification:
```
cd portal
./node_modules/.bin/tsc --outDir /tmp/trainual-suite --module commonjs --target es2022 --esModuleInterop --skipLibCheck lib/training/trainual.test.ts lib/training/validation.test.ts
node --test /tmp/trainual-suite/lib/training/{trainual,validation}.test.js
```
`scripts/test-trainual-import-database.sql` checks cross-tenant import rejection, repeat import,
repeated references and edited/published rollback guards inside an always-rolled-back transaction.

## Security boundary
Training tables have RLS enabled and direct anon/authenticated privileges revoked. Mutations use
service-only RPCs after the portal verifies the signed-in identity and tenant claim. All request IDs
are checked within that tenant. Managers are owner/admin; coaches only learn or edit explicitly
delegated drafts. Answer keys stay server-side for learners. Asset URLs are minted only for authorized
courses/enrollments, designated editors or the uploader. No public storage bucket is used.
