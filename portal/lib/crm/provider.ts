import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertUUID, literal, localSQL, previewReady, root } from './local';

type Binding = { location_id: string; account_sid: string; sender: string; credential_ref: string; connection: string; webhook_url: string | null };
export function twilioSignature(url: string, params: URLSearchParams, secret: string) {
  let input = url;
  for (const key of [...new Set(params.keys())].sort()) for (const value of [...new Set(params.getAll(key))].sort()) input += key + value;
  return createHmac('sha1', secret).update(input).digest('base64');
}
export function signatureValid(url: string, params: URLSearchParams, signature: string, secret: string) {
  const expected = Buffer.from(twilioSignature(url, params, secret)), actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function localSigner() {
  const filename = path.join(root, 'generated-artifacts/crm-preview/signing-key');
  try { return await readFile(filename, 'utf8'); } catch {
    const token = randomBytes(32).toString('hex');
    try { await writeFile(filename, token, { mode: 0o600, flag: 'wx' }); return token; }
    catch { return readFile(filename, 'utf8'); }
  }
}
async function bindingFor(account: string, preview: boolean): Promise<Binding | null> {
  if (preview) {
    if (!previewReady()) return null;
    return localSQL(`SELECT to_jsonb(b) FROM crm_locations b WHERE account_sid=${literal(account)}#>>'{}';`);
  }
  const { createServiceClient } = await import('../supabase/serviceClient');
  const { data, error } = await createServiceClient().from('crm_locations')
    .select('location_id,account_sid,sender,credential_ref,connection,webhook_url').eq('account_sid', account).maybeSingle();
  if (error) throw new Error('Provider connection lookup unavailable');
  return data;
}
export async function processProviderRequest(req: Request, preview = false) {
  const raw = await req.text();
  if (raw.length > 65536) return Response.json({ error: 'Payload too large' }, { status: 413 });
  const form = new URLSearchParams(raw);
  const account = form.get('AccountSid') || '';
  const binding = await bindingFor(account, preview);
  if (!binding) return Response.json({ error: 'Unknown location binding' }, { status: 403 });
  const query = new URL(req.url).searchParams;
  const attempt = query.get('dispatch_id'), leg = query.get('leg');
  let canonical = preview ? 'https://crm.synthetic.invalid/api/crm/provider?preview=1' : binding.webhook_url;
  if (attempt) {
    try { assertUUID(attempt); } catch { return Response.json({ error: 'Invalid dispatch' }, { status: 403 }); }
    if (!['sms','staff','recipient'].includes(leg || '') || !canonical ||
      [...query.keys()].some(key => !['dispatch_id','leg',...(preview ? ['preview'] : [])].includes(key))) {
      return Response.json({ error: 'Invalid callback scope' }, { status: 403 });
    }
    const signedURL = new URL(canonical);
    signedURL.searchParams.set('dispatch_id', attempt);
    signedURL.searchParams.set('leg', leg!);
    canonical = signedURL.toString();
  }
  const secret = preview && binding.account_sid.startsWith('AC_SYNTH_') ? await localSigner()
    : /^CRM_TWILIO_[A-Z0-9_]+$/.test(binding.credential_ref) ? process.env[binding.credential_ref] : undefined;
  if (!canonical || !secret || !signatureValid(canonical, form, req.headers.get('x-twilio-signature') || '', secret)) return Response.json({ error: 'Invalid provider signature' }, { status: 403 });
  const isInbound = !attempt && (form.has('Body') || form.get('Direction') === 'inbound');
  const facility = isInbound ? form.get('To') : form.get('From');
  if (facility !== binding.sender || form.get('AccountSid') !== binding.account_sid) return Response.json({ error: 'Provider location mismatch' }, { status: 403 });
  const event = Object.fromEntries(form);
  event.kind = isInbound ? (form.has('CallSid') ? 'inbound_call' : 'inbound') : (form.has('CallSid') ? 'call_status' : 'sms_status');
  let pilotConfigured = false;
  if (preview) {
    pilotConfigured = await localSQL(`SELECT EXISTS(SELECT 1 FROM crm_pilot_config WHERE location_id='${assertUUID(binding.location_id)}');`);
  } else {
    const { createServiceClient } = await import('../supabase/serviceClient');
    const { data, error } = await createServiceClient().from('crm_pilot_config')
      .select('location_id').eq('location_id', binding.location_id).maybeSingle();
    if (error) return Response.json({ error: 'Pilot binding unavailable' }, { status: 503 });
    pilotConfigured = !!data;
  }
  if (pilotConfigured) {
    if (!isInbound && !attempt) return Response.json({ error: 'Dispatch-bound receipt required' }, { status: 403 });
    try {
      let evidence;
      if (preview) {
        evidence = await localSQL(attempt
          ? `SELECT crm_pilot_receipt('${assertUUID(attempt)}',${literal(leg)}#>>'{}',${literal(event)});`
          : `SELECT crm_pilot_inbound(${literal(account)}#>>'{}',${literal(event)});`);
      } else {
        const { createServiceClient } = await import('../supabase/serviceClient');
        const { data, error } = await createServiceClient().rpc(attempt ? 'crm_pilot_receipt' : 'crm_pilot_inbound',
          attempt ? { p_attempt: attempt, p_leg: leg, p_event: event } : { p_account: account, p_event: event });
        if (error) throw new Error('Provider evidence rejected');
        evidence = data;
      }
      return isInbound && !preview
        ? new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
        : Response.json(evidence);
    } catch { return Response.json({ error: 'Provider pilot evidence rejected' }, { status: 403 }); }
  }
  if (attempt || binding.connection === 'missing') return Response.json({ error: 'Pilot binding unavailable' }, { status: 403 });
  let result;
  if (preview) {
    result = await localSQL(`SELECT crm_provider_event(${literal(account)}#>>'{}',${literal(facility)}#>>'{}',${literal(event)});`);
  } else {
    const { createServiceClient } = await import('../supabase/serviceClient');
    const { data, error } = await createServiceClient().rpc('crm_provider_event', { p_account: account, p_destination: facility, p_event: event });
    if (error) return Response.json({ error: 'Provider event not committed' }, { status: 409 });
    result = data;
  }
  return Response.json(result);
}
export async function syntheticInbound(location: string, phone: string, text: string, key: string) {
  const binding = await localSQL(`SELECT to_jsonb(b) FROM crm_locations b WHERE location_id='${assertUUID(location)}';`) as Binding;
  if (!binding || binding.connection !== 'simulated') throw new Error('Synthetic provider is not enabled for this location');
  const form = new URLSearchParams({ AccountSid: binding.account_sid, To: binding.sender, From: phone, Body: text, MessageSid: `SIM-IN-${key}` });
  const url = 'https://crm.synthetic.invalid/api/crm/provider?preview=1';
  const req = new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-twilio-signature': twilioSignature(url, form, await localSigner()) }, body: form });
  const response = await processProviderRequest(req, true);
  if (!response.ok) throw new Error('Signed synthetic inbound was rejected');
}
export async function syntheticReceipt(location: string, phone: string, sid: string, status: string, call = false) {
  const binding = await localSQL(`SELECT to_jsonb(b) FROM crm_locations b WHERE location_id='${assertUUID(location)}';`) as Binding;
  if (!binding || binding.connection !== 'simulated') throw new Error('Synthetic provider not enabled');
  const form = new URLSearchParams({ AccountSid: binding.account_sid, From: binding.sender, To: phone,
    ...(call ? { CallSid: sid, CallStatus: status } : { MessageSid: sid, MessageStatus: status }) });
  const url = 'https://crm.synthetic.invalid/api/crm/provider?preview=1';
  const response = await processProviderRequest(new Request(url, { method: 'POST', body: form,
    headers: { 'x-twilio-signature': twilioSignature(url, form, await localSigner()) } }), true);
  if (!response.ok) throw new Error('Signed synthetic receipt rejected');
}
