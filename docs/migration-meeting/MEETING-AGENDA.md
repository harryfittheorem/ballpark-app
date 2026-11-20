# Owner meeting · agenda and talk track

**45 minutes · decision requested: authorize discovery and a gated Clearwater pilot**

## 0–5 minutes · Establish the decision

“Today we are asking to verify and prepare a Clearwater pilot. We are not asking to turn off Mindbody or start charging families. We are treating no card re-entry as a required gate, not something already demonstrated.”

Ask explicitly: **“When you said 30 days, did you mean Clearwater or every location?”** Record the answer. If network-wide, explain that vendor timelines and billing-cycle evidence must be assessed before any network commitment.

## 5–15 minutes · Demonstrate built workflows, not migration claims

Use a rehearsed, labelled test environment and approved non-customer fixtures. No live payment or import during the meeting. If unavailable, show prepared screenshots labelled as examples and record the missing demonstration.

| Journey | Show | What must later be validated for Clearwater |
|---|---|---|
| Family | Invite/password setup → correct athletes → book/cancel a slot → membership details | Household/location mapping; existing credit and future-booking accuracy; actual invite delivery; no new card-entry demand. |
| Coach | Authorized family thread → video/assignment → attendance action | Role/location restrictions, delivery, staff workflow and feedback visibility. |
| Front desk | Member lookup → schedule/credit handling → signed-waiver view | Real legacy obligations, future roster, exception handling and access to original evidence. |
| Finance | Test renewal → failure/retry evidence → one ledger transaction → report | Clearly identify Frisco test-mode evidence; do not call it a Clearwater live test. Require account-scoped live acceptance later. |
| Owner / HQ | Location selection → member/report drill-down | No demo fallback, missing locations or unexplained totals in final acceptance environment. |

“The product has these code paths. The migration is a separate operating process: identities, usable cards, future schedules, obligations and legal evidence all have to agree.”

## 15–25 minutes · Explain the two transfers

“Business records and card details take different routes. We can map operational records from approved exports. Sensitive card details must go directly between authorized processors through Stripe’s PCI process, never through our app or email. Moving a card does not move a subscription.”

Explain the new dependency: Mindbody’s published whole-site/cancellation restrictions may prevent an isolated Clearwater export. Ask owners to identify the listed data owner and site structure. Do not ask for passwords, card files or private customer lists in the meeting.

“A future Stripe schedule is reviewed before billing, and cannot be allowed to collect until old collection is confirmed off for that member. If we cannot prove that handoff, we do not switch them.”

## 25–35 minutes · Review gates and contingency

Walk through the 30-day windows, Day 5 escalation, legal/document exclusions, no-re-entry gate and full-cycle observation beyond Day 30. Review the workbook’s hold/stop rules and responsibility assignments.

Likely objection: **“Why not move everyone at once?”** “A staged location rollout lets us see real billing and settlement behavior before repeating it. Shared-vault work may be centrally coordinated without automatically switching every family.”

Likely objection: **“Can’t you fix the importers now?”** “This deliverable identifies readiness work. Implementation, secure sample exports and validation need separately authorized scope. Existing tasks cover some of it; none is treated as finished.”

## 35–45 minutes · Record the limited approval

Read back:

“We authorize discovery and preparation of a gated Clearwater pilot, subject to the agreed discovery budget and secure data-access approvals. This does not authorize software cancellation, collection changes, live charges, unapproved vendor expenditure or network rollout. Finance, operations and the sponsor must sign a separate cutover decision after the evidence gates pass.”

Record sponsor, finance, operations, engineering, migration lead, counsel/records lead and listed data owners by name; discovery budget/cap; intended 30-day scope; provider-question owners; next evidence-review date; and unresolved objections. Use the summary’s blank decision fields. This document contains no actual meeting minutes or invented approvals.
