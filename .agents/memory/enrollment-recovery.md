---
name: Enrollment interruption recovery
description: Why enrollment must track external commits and distinguish card setup from first-invoice payment
---

Record a server-reserved identity before calling Auth account creation, and reconcile that identity on retry. A duplicate-email response alone is not proof that the previous attempt created nothing.

**Why:** Auth can commit the account and trigger-created family before its HTTP response is lost. Treating the retry as a fresh enrollment leaves an account that cannot finish.

**How to apply:** Inject a lost response after remote account creation, and verify the identical request resumes the original family. Partial athlete/waiver writes must also be reusable when rollback cannot reach Auth.

A successful card SetupIntent does not establish successful membership billing. The first recurring invoice can still decline or require authentication.

**Why:** Only retrying activation against an incomplete subscription repeats the same failure forever; starting a new subscription risks duplicate billing.

**How to apply:** Recover the existing invoice, allow a replacement card or native next-action authentication, recheck its payment status, and preserve the successfully charged card for renewals. Keep original setup authorization separate from invoice-recovery payment state.

Database test doubles must distinguish authenticated callers from server service clients rather than sharing unrestricted writes.

**Why:** Otherwise recovery tests can pass while the real database rejects membership persistence after Stripe has already charged.

**How to apply:** Keep billing writes server-only after verified role/tenant checks, and test both denied caller writes and successful service writes, including interrupted persistence.
