# Infinite Hitting Trainual development import

## Subsequent owner-authorized publication

After import verification, the user requested that all signed-in portal team members
can take these courses for now, without removing existing functionality. All nine
imported courses were published through the manager API. Their existing
owner/admin/coach audiences and self-enrollment controls were retained; no bulk
assignments, automatic completions, answer keys or production deployment were created.
The draft-only statements below describe the original import, before this publication.
The four tests remain ungraded reference material.

Verified against the development `ballpark-app` project and the Infinite Hitting business on 2026-11-21. No production deployment or cutover was performed.

## Imported catalog

| Draft course | Topics | Steps | Video references | Source tests |
|---|---:|---:|---:|---:|
| Welcome to the Company | 2 | 5 | 4 | 0 |
| Infinite Business Mastery: Strategies, Systems, and Secrets for Success | 5 | 29 | 27 | 1 |
| Clubhouse Best Practices | 7 | 24 | 12 | 0 |
| Staffing Your Facility | 4 | 17 | 9 | 1 |
| Sales | 6 | 39 | 38 | 1 |
| Marketing | 3 | 12 | 7 | 1 |
| Technology | 4 | 35 | 36 | 0 |
| Instructor Training Videos | 9 | 45 | 71 | 0 |
| Policies/Safety & Compliance | 14 | 35 | 1 | 0 |
| **Total** | **54** | **241** | **205** | **4** |

All nine are editable, unpublished drafts. The five pre-existing demo courses were unchanged. Zero assignments were created for imported courses. Repeating the import returned count zero; repeating staging returned the same batch; a changed-source import returned HTTP 409 instead of replacing existing content.

## Preservation and limitations

- Both original UTF-8 exports are stored byte-for-byte in the tenant-private import batch, with filenames and SHA-256 checksums. Managers can download each original from Migration → source batch history → Source preservation & reconciliation.
- JSON checksum: `223f73e9701bca99eae54015cf79254a0825523af165c673a19a75dcf63a74e6`.
- Markdown checksum: `b7ca1215a44e5b19592c3312b40b39514bcafb5e7755cdc1a165bb284a7b42b2`.
- Imported text retains original titles, ordered topics and steps, bodies, category, update text, source URLs and notes. All 205 video occurrences retain lesson associations, including repeats (202 unique URLs).
- **Independently archived videos, screenshots and attachment files: zero.** Original export preservation is not media preservation. YouTube and Loom remain externally hosted and may require access or become unavailable.
- There are 42 additional extracted resource references, of which 25 Trainual references are explicitly unresolved/unavailable. They are not silently redirected to guessed destinations.
- Marketing step 8 contains the original protected Scribe gap notice, not the inaccessible body.
- The JSON merged four tests into preceding lessons and substituted survey URLs for their source URLs. Original data is retained and the anomaly is flagged. Separate source-test review panels use the Markdown test sections.
- Four tests retain 41 questions and options (8, 5, 21, 7), including written-answer questions. They await answer-key review; no grading keys, attempts or completions were fabricated.
- Attached documents and screenshots were not downloaded. Original notes retain the instructor-video/title mismatches, missing call-number range, technology header/count mismatch and other source observations.
- Export counts do not establish completeness of the live Trainual account. No historical learner records were supplied.

## Verification

- Portal typecheck and 16 fixture/unit tests passed, including source ordering, all media associations, deterministic identities, missing Scribe state, missing answer keys, unsafe URLs and embed allowlists.
- The existing rollback-only training database assertions passed against development: pinned versions, progress/completion checks, stale-write protection, private-table permissions, import and rollback.
- Actual import was performed through the authenticated manager portal API, not by inserting course rows directly.
- `scripts/import-trainual-development.mjs` repeats the actual staging/import checks with explicit target guards and uses only the existing synthetic review owner. It reads runtime credentials without printing or persisting them.
- Additional rollback-only import assertions passed: cross-tenant rejection, repeated references, idempotent reimport, no enrollment, and edited/published rollback guards.
- Authenticated synthetic-coach API checks passed: both same-tenant and other-tenant coaches cannot stage or export migrations (403); same-tenant draft access is denied (403), and another tenant cannot retrieve the imported course (404).
- Browser checks confirmed manager staging twice returns the existing imported batch, searchable library displays all nine drafts, and sectioned previews navigate through every imported step without application errors. YouTube/Loom embed DOM was verified, not external provider playback.
- An isolated two-lesson synthetic fixture passed UI editing/save, publication, lesson completion, previous/next navigation and reload-resume. Self-enrollment used the authenticated API for the synthetic owner only. The fixture appeared in Reports and was archived afterward; no imported course was published or assigned. Report row values and the Assign tab were not separately re-tested.
- Browser inspection confirmed the Marketing Instagram lesson displays an explicit missing-source-content notice. Original-download bytes were verified against private database archives; the download buttons were not browser-tested.

Open `/training` in the development preview, then **Library**. Imported courses are marked as drafts requiring source review. Existing publish/assignment controls remain explicit manager actions.
