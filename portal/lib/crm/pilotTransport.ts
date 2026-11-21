/**
 * Staff-only rehearsal transport. Caller supplies a durable, already-authorized
 * dispatch claim, never an arbitrary browser payload. No retries: uncertainty
 * must be reconciled against provider evidence before another attempt.
 */
export type PilotClaim = {
  id: string;
  account_sid: string;
  sender: string;
  recipient: string;
  staff_handset: string | null;
  credential_ref: string;
  callback_url: string;
  kind: 'sms' | 'call';
  body: string;
  approval: string;
  approved_numbers: string[];
};

export type PilotTransportResult = {
  status: 'accepted' | 'failed' | 'unknown' | 'blocked';
  provider_sid?: string;
  reason: string;
};

type Runtime = {
  enabled: boolean;
  credential: (reference: string) => string | undefined;
  request?: typeof fetch;
};
const phone = /^\+[1-9]\d{7,14}$/;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const escapeXML = (text: string) => text.replace(/[<>&"']/g, value => (
  { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[value]!
));

/** Validation has no network effects and can be used in readiness checks. */
export function pilotClaimProblem(claim: PilotClaim, enabled: boolean): string | null {
  if (!enabled) return 'Staff-only provider rehearsal has not been explicitly enabled';
  if (!uuid.test(claim.id) || !/^AC[a-f0-9]{32}$/i.test(claim.account_sid)) return 'Invalid approved dispatch identity';
  if (!claim.approval.trim()) return 'Pilot approval evidence required';
  if (!/^CRM_TWILIO_[A-Z0-9_]+$/.test(claim.credential_ref)) return 'Server credential reference required';
  if (!phone.test(claim.sender) || !phone.test(claim.recipient)) return 'Invalid sender or recipient';
  if (claim.sender === claim.recipient) return 'Sender cannot be the recipient';
  if (!claim.approved_numbers.includes(claim.sender) || !claim.approved_numbers.includes(claim.recipient)) {
    return 'Both sender and recipient must be approved staff-pilot identities';
  }
  try {
    const callback = new URL(claim.callback_url);
    if (callback.protocol !== 'https:' || callback.username || callback.password ||
        callback.hash || callback.search || !callback.pathname.endsWith('/api/crm/provider')) {
      return 'Approved canonical HTTPS callback URL required';
    }
  } catch { return 'Approved canonical HTTPS callback URL required'; }
  if (claim.kind === 'sms' && (!claim.body.trim() || claim.body.length > 1600 ||
      /\{\{|\[[^\]]*\]/.test(claim.body))) return 'Reviewed resolved SMS required';
  if (claim.kind === 'call' && (!claim.staff_handset || !phone.test(claim.staff_handset) ||
      !claim.approved_numbers.includes(claim.staff_handset) ||
      claim.staff_handset === claim.sender || claim.staff_handset === claim.recipient)) {
    return 'Distinct approved staff callback handset required';
  }
  return null;
}

export function pilotStatusURL(claim: PilotClaim, leg: 'sms' | 'staff' | 'recipient') {
  const url = new URL(claim.callback_url);
  url.searchParams.set('dispatch_id', claim.id);
  url.searchParams.set('leg', leg);
  return url.toString();
}

export async function sendPilotClaim(claim: PilotClaim, runtime: Runtime): Promise<PilotTransportResult> {
  const problem = pilotClaimProblem(claim, runtime.enabled);
  if (problem) return { status: 'blocked', reason: problem };
  const credential = runtime.credential(claim.credential_ref);
  if (!credential) return { status: 'blocked', reason: 'Location credential is not provisioned; draft retained' };
  const params = new URLSearchParams({ From: claim.sender });
  let resource: string;
  if (claim.kind === 'sms') {
    resource = 'Messages';
    params.set('To', claim.recipient);
    params.set('Body', claim.body);
    params.set('StatusCallback', pilotStatusURL(claim, 'sms'));
  } else {
    resource = 'Calls';
    // Call staff first; connecting a staff bridge is not evidence the parent
    // answered. Only the separately signed recipient leg can establish that.
    params.set('To', claim.staff_handset!);
    params.set('StatusCallback', pilotStatusURL(claim, 'staff'));
    params.set('StatusCallbackEvent', 'completed');
    params.set('Twiml', '<Response><Dial answerOnBridge="true" callerId="' +
      escapeXML(claim.sender) + '"><Number statusCallback="' +
      escapeXML(pilotStatusURL(claim, 'recipient')) +
      '" statusCallbackEvent="initiated ringing answered completed">' +
      escapeXML(claim.recipient) + '</Number></Dial></Response>');
  }
  try {
    const response = await (runtime.request || fetch)(
      `https://api.twilio.com/2010-04-01/Accounts/${claim.account_sid}/${resource}.json`,
      { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: 'Basic ' + Buffer.from(`${claim.account_sid}:${credential}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded' }, body: params },
    );
    if (!response.ok) {
      const definiteRejection = response.status >= 400 && response.status < 500 &&
        ![408, 409, 429].includes(response.status);
      return { status: definiteRejection ? 'failed' : 'unknown',
        reason: definiteRejection ? 'Provider rejected request; reviewed draft retained'
          : 'Provider outcome uncertain; reconcile without retry' };
    }
    const result = await response.json();
    if (typeof result.sid !== 'string' || !/^(SM|MM|CA)[a-f0-9]{32}$/i.test(result.sid)) {
      return { status: 'unknown', reason: 'Provider response lacked authoritative attempt identity; reconcile without retry' };
    }
    return { status: 'accepted', provider_sid: result.sid,
      reason: claim.kind === 'sms' ? 'Provider accepted; delivery receipt pending'
        : 'Staff bridge accepted; recipient answer is not yet established' };
  } catch {
    return { status: 'unknown', reason: 'Request interrupted; provider may have accepted; reconcile without retry' };
  }
}
