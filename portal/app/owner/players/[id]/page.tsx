import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwnerContext } from '@/lib/ownerAccess';
import { getScopedPlayer } from '@/lib/supabase/playerProfile';
import { getMemberDetail, getBookingFormOptions, getPlayerCoachingHistory, type CoachLessonDetail } from '@/lib/supabase/ownerQueries';
import { MemberDetailContent } from '../../members/[id]/MemberDetailContent';
import { playerHref } from '@/lib/playerLinks';
import { createServiceClient } from '@/lib/supabase/serviceClient';

export const metadata = { title: 'Player profile — Clubhouse by Infinite Hitting' };

export default async function PlayerPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ membership?: string; paymentsPage?: string; lessonsPage?: string }>;
}) {
  const [{ id }, query, { client, tenantId }] = await Promise.all([params, searchParams, requireOwnerContext()]);
  const player = await getScopedPlayer(client, tenantId, id);
  if (!player) notFound();
  const selected = query.membership
    ? player.memberships.find(m => m.id === query.membership)
    : player.memberships[0];
  if (query.membership && !selected) notFound();
  // Access and location relationships were checked above using the owner's
  // authenticated client. Historical tables such as family_waivers have
  // parent-only RLS, so preserve the existing server-side history reader,
  // restricted to this verified family/player and its membership IDs.
  const historyClient = createServiceClient();
  const requestedPage = Number(query.paymentsPage ?? 1);
  const paymentsPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedLessonsPage = Number(query.lessonsPage ?? 1);
  const lessonsPage = Number.isSafeInteger(requestedLessonsPage) && requestedLessonsPage > 0 ? requestedLessonsPage : 1;
  const pageSize = 50;

  const [detail, bookingOptions, lessonHistory, payments] = await Promise.all([
    selected ? getMemberDetail(historyClient, tenantId, selected.id) : Promise.resolve(null),
    getBookingFormOptions(historyClient, tenantId),
    getPlayerCoachingHistory(client, id, lessonsPage),
    player.memberships.length ? historyClient.from('payment_events')
      .select('id, membership_id, created_at, amount_cents, payment_method, status', { count: 'exact' })
      .eq('tenant_id', tenantId).in('membership_id', player.memberships.map(m => m.id))
      .order('created_at', { ascending: false }).order('id')
      .range((paymentsPage - 1) * pageSize, paymentsPage * pageSize - 1) : Promise.resolve({ data: [], error: null, count: 0 }),
  ]);
  if (payments.error) throw new Error('Unable to load payment history. Please retry.');
  if (selected && !detail) throw new Error('Unable to load membership details. Please retry.');
  const paymentPageHref = (page: number) =>
    `/owner/players/${id}?${new URLSearchParams({ ...(selected ? { membership: selected.id } : {}), paymentsPage: String(page), lessonsPage: String(lessonsPage) })}#payment-history`;
  const lessonPageHref = (page: number) =>
    `/owner/players/${id}?${new URLSearchParams({ ...(selected ? { membership: selected.id } : {}), paymentsPage: String(paymentsPage), lessonsPage: String(page) })}#lesson-history`;

  let waiverStatus: 'signed' | 'unsigned' | 'outdated' | null = null;
  let waiverSignedAt: string | null = null;
  const activeWaiver = await historyClient.from('waivers').select('id').eq('tenant_id', tenantId).eq('is_active', true).maybeSingle();
  if (activeWaiver.error) throw new Error('Unable to load waiver status. Please retry.');
  if (activeWaiver.data) {
    const signed = await historyClient.from('family_waivers').select('signed_at')
      .eq('family_id', player.kid.family_id).eq('waiver_id', activeWaiver.data.id).maybeSingle();
    if (signed.error) throw new Error('Unable to load waiver status. Please retry.');
    waiverSignedAt = signed.data?.signed_at ?? null;
    const previous = !signed.data ? await historyClient.from('family_waivers').select('id')
      .eq('family_id', player.kid.family_id).limit(1).maybeSingle() : null;
    if (previous?.error) throw new Error('Unable to load waiver status. Please retry.');
    waiverStatus = signed.data ? 'signed' : previous?.data ? 'outdated' : 'unsigned';
  }

  return (
    <>
      <nav aria-label="Player history" className="owner-profile-nav">
        <strong style={{ alignSelf: 'center' }}>{[player.kid.first_name, player.kid.last_name].filter(Boolean).join(' ')}</strong>
        <Link href="/owner/members">All members</Link>
        <a href="#player-details">Profile</a>
        <a href="#lesson-history">Lesson history</a>
        <a href="#payment-history">Payment history</a>
        <a href="#package-history">Package history</a>
      </nav>
      <section id="player-details">
        {detail ? <MemberDetailContent key={detail.id} member={detail} bookingOptions={bookingOptions}
          waiverStatus={waiverStatus} waiverSignedAt={waiverSignedAt} /> :
          <h1>{[player.kid.first_name, player.kid.last_name].filter(Boolean).join(' ')} — no linked memberships</h1>}
      </section>
      <section id="lesson-history" className="owner-history-section">
        <h2>Session history</h2>
        <p>Completed, no-show, and cancelled training sessions recorded for this player. Instructor names reflect the actual recorded instructor.</p>
        {!lessonHistory.rows.length ? <p>{lessonsPage > 1 ? 'No sessions on this page.' : 'No session history recorded for this player.'}</p> :
          <div role="region" aria-label="Player session history" tabIndex={0} style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left' }}>
              <thead><tr><th>Player</th><th>Date &amp; time</th><th>Actual instructor</th><th>Session type</th><th>Status</th><th>Rating</th></tr></thead>
              <tbody>{lessonHistory.rows.map((lesson: CoachLessonDetail) => <tr key={lesson.id}>
                <td>{lesson.kid_name || 'Not recorded'}</td>
                <td>{formatLessonDateTime(lesson.scheduled_start, lesson.scheduled_end)}</td>
                <td>{lesson.actual_coach_name || 'Not recorded'}</td>
                <td>{lesson.type_name || 'Not recorded'}</td>
                <td>{lessonStatusLabel(lesson.status)}</td>
                <td>{lesson.rating == null ? 'Not rated' : `${lesson.rating}/5`}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        <nav aria-label="Lesson history pages" className="owner-payment-tools">
          {lessonsPage > 1 && <Link href={lessonPageHref(lessonsPage - 1)}>Previous sessions</Link>}
          <span style={{ alignSelf: 'center' }}>Page {lessonsPage} · {lessonHistory.total} sessions</span>
          {lessonHistory.total > lessonsPage * pageSize && <Link href={lessonPageHref(lessonsPage + 1)}>Next sessions</Link>}
        </nav>
      </section>
      <section id="package-history" className="owner-history-section">
        <h2>Package history</h2>
        <p>All recorded memberships and packages for this player. Choose one to view its details.</p>
        {player.memberships.length === 0 ? <p>No package history recorded.</p> :
          <ul>{player.memberships.map(m => <li key={m.id}>
            <Link href={playerHref({ kidId: id, membershipId: m.id })!} aria-current={selected?.id === m.id ? 'true' : undefined}>
              {m.plan_name} — {m.status} — {m.started_at ? new Date(m.started_at).toLocaleDateString('en-US') : 'Start date unavailable'}
            </Link>
            {m.plan_type === 'otc' && <span> · Sessions remaining: {m.sessions_remaining ?? 'unavailable'} / {m.sessions_total ?? 'unavailable'}</span>}
          </li>)}</ul>}
      </section>
      <section id="payment-history" className="owner-history-section">
        <h2>Payment history</h2>
        <p>Recorded payment events across this player’s linked memberships. Currency is not supplied by these legacy records. No new charges are initiated here.
          {' '}Store-order failures are listed separately in <Link href="/owner/failed-payments">Failed Payments</Link>; they are not included in this membership history.
        </p>
        {!payments.data?.length ? <p>{paymentsPage > 1 ? 'No payments on this page.' : 'No recorded payments for this player.'}</p> :
          <div role="region" aria-label="Player payment history" tabIndex={0} style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left' }}>
              <thead><tr><th>Date</th><th>Package</th><th>Recorded amount</th><th>Method</th><th>Status</th></tr></thead>
              <tbody>{payments.data.map(p => <tr key={p.id}>
                <td>{new Date(p.created_at).toLocaleDateString('en-US')}</td>
                <td>{player.memberships.find(m => m.id === p.membership_id)?.plan_name ?? 'Unavailable'}</td>
                <td>{(p.amount_cents / 100).toFixed(2)}</td><td>{p.payment_method ?? 'Unavailable'}</td><td>{p.status}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        <nav aria-label="Payment history pages" className="owner-payment-tools">
          {paymentsPage > 1 && <Link href={paymentPageHref(paymentsPage - 1)}>Previous payments</Link>}
          <span style={{ alignSelf: 'center' }}>Page {paymentsPage} · {payments.count ?? 0} recorded payments</span>
          {(payments.count ?? 0) > paymentsPage * pageSize && <Link href={paymentPageHref(paymentsPage + 1)}>Next payments</Link>}
        </nav>
      </section>
    </>
  );
}

function formatLessonDateTime(start: string, end: string): string {
  const startsAt = new Date(start);
  if (Number.isNaN(startsAt.getTime())) return 'Date and time unavailable';
  const startText = startsAt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const endsAt = new Date(end);
  const endText = Number.isNaN(endsAt.getTime())
    ? ''
    : endsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return endText ? `${startText} – ${endText}` : startText;
}

function lessonStatusLabel(status: string): string {
  if (status === 'completed') return 'Completed';
  if (status === 'no_show') return 'No-show';
  if (status === 'cancelled') return 'Cancelled';
  return status || 'Not recorded';
}
