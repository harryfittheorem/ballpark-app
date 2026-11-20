import type { CRMCommand, CRMState, CRMThread } from './types';

export class TransientModelError extends Error {}
export type ModelReply =
  | { type: 'reply'; text: string }
  | { type: 'tool'; name: 'find_available_slots'; args: Record<string, never> }
  | { type: 'tool'; name: 'book_appointment'; args: { slot_id: string } }
  | { type: 'tool'; name: 'escalate_to_human'; args: { reason: string } };
export type ModelRequest = (input: {
  thread: CRMThread; knowledge: string; knowledgeVersion: number;
  available: CRMState['slots']; results: { name: string; result: string }[];
}) => Promise<ModelReply>;
type Apply = (command: CRMCommand) => Promise<CRMState>;

/** Adapted from the handoff and checked against the pinned donor engine.
 * The single transient retry surrounds model requests ONLY, never tool effects.
 */
export async function runAssistant(state: CRMState, threadId: string, turnKey: string, model: ModelRequest, apply: Apply) {
  let current = state;
  const results: { name: string; result: string }[] = [];
  const thread = () => {
    const t = current.threads.find(x => x.id === threadId);
    if (!t) throw new Error('Conversation unavailable');
    return t;
  };
  const action = async (kind: string, extra: Partial<CRMCommand>, suffix: string) => {
    const t = thread();
    current = await apply({ kind, ...extra, source: 'agent', key: `${turnKey}:${suffix}`, thread_id: t.id, revision: t.revision });
  };
  const handoff = async (reason: string) => {
    await action('callback', { text: reason }, 'handoff');
    return current;
  };
  for (let iteration = 0; iteration < 6; iteration++) {
    let reply: ModelReply;
    try {
      const authorized = thread();
      // Private staff notes are not parent-facing model knowledge.
      const modelThread = { ...authorized, note_draft: '', events: authorized.events.filter(e => e.kind !== 'private note') };
      const input = { thread: modelThread, knowledge: current.workflow.knowledge, knowledgeVersion: current.workflow.version, available: current.slots, results };
      try { reply = await model(input); }
      catch (error) { if (!(error instanceof TransientModelError)) throw error; reply = await model(input); }
    } catch { return handoff('Assistant unavailable; review latest parent question'); }
    if (thread().hold) return handoff('Assistant paused by durable hold');
    if (!reply || typeof reply !== 'object') return handoff('Invalid model output');
    if (reply.type === 'reply') {
      if (typeof reply.text !== 'string' || !reply.text.trim() || /\[[\s\S]*?\]|\{\{[\s\S]*?\}\}/.test(reply.text)) return handoff('Invalid assistant draft');
      // Free-form output is a draft, never evidence of a committed booking.
      await action('save_sms', { text: reply.text }, `draft:${iteration}`);
      return current;
    }
    if (reply.type !== 'tool' || !reply.args || typeof reply.args !== 'object' || Array.isArray(reply.args)) return handoff('Unsupported model action');
    try {
      if (reply.name === 'find_available_slots') {
        if (Object.keys(reply.args).length) return handoff('Invalid availability arguments');
        await action('offer_slots', {}, `availability:${iteration}`);
        results.push({ name: reply.name, result: 'Eligible openings inspected; draft prepared, no send or reservation.' });
      } else if (reply.name === 'book_appointment') {
        if (Object.keys(reply.args).some(k => k !== 'slot_id') || typeof reply.args.slot_id !== 'string') return handoff('Invalid booking arguments');
        if (current.workflow.authority !== 'delegated' || !current.workflow.enabled) return handoff('Draft authority cannot reserve; staff action required');
        if (!thread().selection || thread().selection !== reply.args.slot_id) return handoff('Parent selection required before reservation');
        await action('book', { slot_id: reply.args.slot_id }, 'evaluation');
        const booked = thread().booking;
        if (!booked || booked.status !== 'confirmed') return handoff('Booking uncertain; reconcile original intent before retry');
        results.push({ name: reply.name, result: `Canonical confirmed booking ${booked.id}` });
        await action('send', { text: thread().sms_draft }, 'confirmation');
        await action('dispatch', {}, 'dispatch');
        return current;
      } else if (reply.name === 'escalate_to_human') {
        if (Object.keys(reply.args).some(k => k !== 'reason') || typeof reply.args.reason !== 'string' || !reply.args.reason.trim()) return handoff('Invalid handoff arguments');
        return handoff(reply.args.reason);
      } else return handoff('Unsupported model tool');
    } catch {
      // Effects may have committed. Stable reservation intent is reconciled
      // before any further model turn; no automatic tool retry.
      try { await action('reconcile', {}, 'reconcile'); } catch { /* Durable action ledger remains the recovery source. */ }
      return handoff('Action outcome requires staff reconciliation');
    }
  }
  return handoff('Six-iteration assistant limit reached');
}

/** Controlled provider double, intentionally not presented as a live model. */
export const controlledInquiryModel: ModelRequest = async ({ thread, results }): Promise<ModelReply> => {
  const question = [...thread.events].reverse().find(e => e.author === 'parent')?.body || '';
  if (/coach|call me/i.test(question)) return { type: 'tool', name: 'escalate_to_human', args: { reason: 'Parent requests coach callback' } };
  if (thread.selection && !thread.booking) return { type: 'tool', name: 'book_appointment', args: { slot_id: thread.selection } };
  if (!results.length) return { type: 'tool', name: 'find_available_slots', args: {} };
  return { type: 'reply', text: thread.sms_draft || 'Staff will review eligible evaluation openings with you.' };
};
