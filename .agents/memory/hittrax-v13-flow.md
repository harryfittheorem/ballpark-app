---
name: HitTrax v1.3 API flow
description: Critical differences between old v1.x and current v1.3 spec — association, disconnect, and create account flows.
---

## Rule
The HitTrax integration is built on the v1.3 Third Party API spec (PDF in `attached_assets/`). Do NOT use the old v1.x email-based flow.

## Key v1.3 differences

### Associate flow — two authentication paths (both go to 'active' immediately)

**Path A – Password** (user enters HitTrax password once, never stored):
1. `GET AuthenticateCloudUser?UserName=...&Password=...&UseOTP=false` → session token
2. `GET AssociateThirdPartyAccountWithCloudCredentials?UserSessionToken=...&ThirdPartyUserID=<kid-uuid>` → ThirdPartyUserPassword
3. `GET LogOutThirdPartyCloudUser?UserSessionToken=...` (best-effort)
4. Store ThirdPartyUserPassword, status = 'active'

**Path B – OTP/SMS** (no password needed; requires phone number in HitTrax):
1. `GET AuthenticateCloudUser?UserName=...&Password=&UseOTP=true`
   → HitTrax responds "Error: Waiting for OTP response" — this IS success (SMS sent)
   → Return `{ status: 'otp_sent' }` to client. No DB write yet.
2. User enters the SMS code
3. `GET ProvideOTPResponseCode?UserName=...&OTPCode=...` → session token
   (Note: spec URL shows "OPTCode" — typo. Correct param is "OTPCode")
4. Same as Path A steps 2-4 from here

### Disconnect flow (was: POST ThirdPartyUserID+Password directly)
v1.3 `RemoveThirdPartyAssociationFromCloudUser` requires a session token:
1. `GET AuthenticateCloudUserViaThirdParty?ThirdPartyUserID=...&ThirdPartyUserPassword=...` → session token
2. `GET RemoveThirdPartyAssociationFromCloudUser?UserSessionToken=...` → "true"
3. `GET LogOutThirdPartyCloudUser?UserSessionToken=...` (best-effort)

### Create account (new in v1.3 — hero feature for Phase 2)
1. `GET CheckForCloudUsernameEligibility?CloudUsername=...` → "true"/"false"
2. `POST CreateCloudUserAccount` with JSON body → ThirdPartyUserPassword
   - Body includes: Username, ThirdPartyUsername, Password, FirstName, LastName, Birthdate (MM/DD/YYYY), Email, GuardianEmailAddress (required if <13), Gender, Sport, SkillLevel, Position, Bats, Throws
   - Link is automatically created at same time — no separate associate call needed

### Polling (unchanged)
`GetAvailableThirdPartyData` still takes ThirdPartyUserID + ThirdPartyUserPassword directly (no session token required).

### Inbound callbacks still valid
- `ForgetHitTraxUser` (POST from HitTrax) — GDPR/COPPA — still correct in v1.3

### Deprecated (kept for backward compat with v1.x legacy users)
- `hittrax-registration-complete` / `CompleteHitTraxRegistration` — the email confirmation callback. No longer used for new connections but kept so existing pending-state users can still activate.

## Why
The old `AssociateThirdPartyAccount` (v1.x) endpoint was replaced. Calling it returned "No HitTrax User found" because it doesn't exist in v1.3. The new endpoint name is `AssociateThirdPartyAccountWithCloudCredentials` and requires authentication first.

## Shared helpers (supabase/functions/_shared/hittrax.ts)
All v1.3 endpoint functions are exported:
- `authenticateCloudUser(cfg, username, password)` → sessionToken
- `triggerOTP(cfg, username)` → void (fires SMS; treats "Waiting for OTP response" as success)
- `submitOTPCode(cfg, username, otpCode)` → sessionToken
- `authenticateCloudUserViaThirdParty(cfg, thirdPartyUserId, thirdPartyUserPassword)` → sessionToken
- `associateThirdPartyAccount(cfg, sessionToken, thirdPartyUserId)` → ThirdPartyUserPassword
- `removeThirdPartyAssociation(cfg, sessionToken)` → void
- `logOutSession(cfg, sessionToken)` → void (best-effort, never throws)
- `checkCloudUsernameEligibility(cfg, cloudUsername)` → boolean
- `createCloudUserAccount(cfg, params)` → ThirdPartyUserPassword
- `hitTraxErrorResponse(err)` → maps thrown errors to structured Response

## Session token behaviour
- Expires after 2h of inactivity
- Never store session tokens — generate fresh per-request
- One CloudUser can have multiple active sessions across different third parties simultaneously
