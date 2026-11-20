---
name: Scheduling operating policies
description: Approved manual capacity, walk-ins, instructor corrections and recurring credit rules.
---

Use manually configured location capacity initially, with separate limits for lessons and rentals and no overlapping use of the same cage. Do not invent location-specific numbers.

**Why:** The user explicitly selected “Manual location limits (recommended)” after the choice between manual limits and coach-availability-derived limits was explained.

**How to apply:** Use this as the initial capacity model, not as authorization to set numeric limits or to approve walk-in exceptions, recurring charges, instructor-correction permissions, camp financial policies or live camp sales. Those were explicitly excluded from this decision.

Walk-ins follow the same capacity, cage-conflict and credit/entitlement rules as advance bookings. Authorized scheduling staff select an existing athlete; attendance and actual-instructor capture remain separate manual actions.

**Why:** The user explicitly approved “Same rules (recommended)” for walk-ins after these constraints were explained.

**How to apply:** Do not interpret walk-in status as an overbooking permission, free attendance, a credit bypass or approval of paid drop-ins without an existing entitlement.

Owners and admins assigned to the booking's location may correct the actual instructor after check-in. Every correction requires a reason and preserves the actor, time and previous instructor. Instructors do not receive this separate correction permission.

**Why:** The user explicitly selected “Owners and location admins (recommended)” after the role scope and audit requirements were explained.

**How to apply:** Enforce the role and location restriction on direct requests as well as in portal/mobile controls. Normal initial check-in and its existing undo behavior remain separate.

The initial recurring-booking version uses existing credit rules at booking time. Every occurrence must pass capacity, resource and credit checks; otherwise the entire series saves nothing and deducts nothing. It introduces no additional card charges and does not borrow credits from future renewals.

**Why:** The user explicitly selected “Use existing credit rules” after the all-or-nothing behavior and limitation for weekly-renewing plans were explained.

**How to apply:** A long series may be rejected for insufficient current entitlement. Future-week entitlement and failed-renewal rules are not approved by this choice.

Owners and admins assigned to the location may override lesson or rental capacity for one dated time window. It affects all bookings in that category/window, not one athlete, and must leave normal limits and other recurring dates unchanged.

**Why:** The user explicitly selected “Owners and location admins (recommended)” after the time-window scope, audit requirements and safeguards were explained.

**How to apply:** Require a reason and audit history. Reject conflicting overlapping overrides and reductions below existing reservations; never bypass cage conflicts or assume a numeric limit.

Owners configure actual location cages as instruction, rental or shared resources. Rentals require a configured assigned cage; lessons may remain unassigned until staff assign one. No inventory counts are assumed.

**Why:** The user selected “Require cage for rentals (recommended)” after this resource setup and assignment approach was explained.

**How to apply:** Enforce rental assignment below the UI, including walk-ins and recurring occurrences. Customer booking may allocate a free cage internally without asking customers to choose a named instructor.

Build camp events, multi-day rosters and separate daily check-in, but keep paid camp sales disabled.

**Why:** The user selected “Keep sales disabled (recommended)”; the proposal explicitly did not approve financial policies.

**How to apply:** Do not enable live sales or invent refunds, cancellations, partial-attendance or payment/capacity-failure handling. Draft creation is not enrollment or attendance.
