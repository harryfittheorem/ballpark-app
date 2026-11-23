import type {
  RetentionDataset, RetentionFilters, RetentionPolicy, RetentionReport,
  RetentionRow, MembershipEvidence, SegmentEvidence,
} from './types';

export const DIVISIONS = ['8U', '10U', '12U', '14U', 'HS', 'College'];
export const TENURE_BANDS = ['0–30 days', '31–90 days', '91–180 days', '181–270 days', '271–360 days', 'After 360 days — policy pending', 'Unknown prior history'];
export function tenureBand(days: number | null): string {
  if (days === null || days < 0) return TENURE_BANDS[6];
  return TENURE_BANDS[[30, 90, 180, 270, 360].findIndex(edge => days <= edge)] ?? TENURE_BANDS[5];
}
const dateValue = (s: string) => new Date(s).getTime();
const rate = (n: number, d: number) => d > 0 ? Math.round(n / d * 1000) / 10 : null;
export function shiftMonth(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7);
}
export function lastCompletedMonth(now = new Date(), timezone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  return shiftMonth(`${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`, -1);
}
/** Local midnight -> UTC, including DST. No server-local timezone dependence. */
export function monthBoundary(month: string, timezone: string): number {
  const target = Date.parse(`${month}-01T00:00:00Z`);
  let guess = target;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x => [x.type, x.value]));
    const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    guess += target - local;
  }
  return guess;
}
export function validPolicy(p: RetentionPolicy | undefined): p is RetentionPolicy {
  return !!p && !!p.version && !!p.approvalReference && Number.isFinite(dateValue(p.effectiveFrom))
    && p.entity === 'player' && p.loss === 'absent_at_close'
    && ['retained', 'excluded'].includes(p.pauses) && p.expiry === 'expires_at'
    && p.reactivation === 'retained_at_close' && p.transfer === 'opening_location'
    && p.location === 'family_primary_at_open' && p.cancellationDate === 'cancel_effective_at_then_cancelled_at'
    && p.timezone === 'location' && p.segments === 'recorded_at_open'
    && p.tenure === 'current_spell_elapsed_days' && p.privacy === 'owner_names_network_aggregate';
}
function latest<T extends { effective_at: string; recorded_at: string; id: string }>(rows: T[], at: number): T | undefined {
  return rows.filter(r => dateValue(r.effective_at) <= at && dateValue(r.recorded_at) <= at)
    .sort((a, b) => dateValue(b.effective_at) - dateValue(a.effective_at)
      || dateValue(b.recorded_at) - dateValue(a.recorded_at) || b.id.localeCompare(a.id))[0];
}
function exit(row: MembershipEvidence): { at: number; reason: 'cancellation' | 'nonrenewal' } | null {
  const s = row.state;
  const cancel = s.cancel_effective_at || (s.status === 'cancelled' ? s.cancelled_at : null);
  const candidates = [
    ...(cancel ? [{ at: dateValue(cancel), reason: 'cancellation' as const }] : []),
    ...(s.expires_at ? [{ at: dateValue(s.expires_at), reason: 'nonrenewal' as const }] : []),
  ].filter(c => Number.isFinite(c.at));
  return candidates.sort((a, b) => a.at - b.at)[0] ?? null;
}
function eligible(row: MembershipEvidence | undefined, at: number, p: RetentionPolicy): boolean {
  if (!row || row.state.deleted) return false;
  const s = row.state;
  if (!['active', 'payment_overdue', ...(p.pauses === 'retained' ? ['paused'] : [])].includes(s.status)) return false;
  if (!s.started_at || dateValue(s.started_at) > at) return false;
  const end = exit(row);
  return !end || end.at > at;
}
function matches(segment: SegmentEvidence | undefined, filters: RetentionFilters): boolean {
  return (['division', 'sport', 'gender', 'competition'] as const).every(key =>
    !filters[key] || (segment?.state[key] || 'unknown') === filters[key]);
}
function observedSpellDays(groups: MembershipEvidence[][], at: number, coverage: number, policy: RetentionPolicy): number | null {
  const events = groups.flat().filter(r => dateValue(r.recorded_at) <= at);
  const firstObserved = new Map(groups.map(rows => [rows[0].membership_id,
    Math.min(...rows.filter(r => dateValue(r.recorded_at) <= at)
      .map(r => Math.max(dateValue(r.effective_at), dateValue(r.recorded_at))))]));
  const times = [...new Set(events.flatMap(r => [
    Math.max(dateValue(r.effective_at), dateValue(r.recorded_at)),
    ...(r.state.started_at ? [dateValue(r.state.started_at)] : []),
    ...(exit(r) ? [exit(r)!.at] : []),
  ]).filter(t => t >= coverage && t <= at))].sort((a, b) => a - b);
  let present = false;
  let observedState = false;
  let spellStart: number | null = null;
  for (const t of times) {
    const active = groups.map(rows => latest(rows, t)).filter(r => eligible(r, t, policy)) as MembershipEvidence[];
    if (active.length && !present) {
      // A baseline/backdated start cannot establish when a prior spell began.
      const unknownStart = active.some(r => {
        const first = firstObserved.get(r.membership_id)!;
        return (!observedState || first === t) && (r.source === 'baseline'
          || !r.state.started_at || dateValue(r.state.started_at) < first);
      });
      spellStart = unknownStart ? null : t;
    } else if (!active.length) spellStart = null;
    present = active.length > 0;
    observedState ||= groups.some(rows => !!latest(rows, t));
  }
  return present && spellStart !== null ? Math.floor((at - spellStart) / 86400000) : null;
}

/** Every summary is a sum of the same filtered monthly player cohorts/detail rows. */
export function buildRetentionReport(data: RetentionDataset, filters: RetentionFilters): RetentionReport {
  const months: RetentionRow[] = [];
  const lostPlayers: RetentionReport['lostPlayers'] = [];
  const tenure = TENURE_BANDS.map(label => ({ label, opening: 0, losses: 0, churnRate: null as number | null }));
  const divisions = [...DIVISIONS, 'Unknown'].map(label => ({ label, opening: 0, losses: 0, churnRate: null as number | null }));
  const empty = (month: string, unavailable: string[]): RetentionRow =>
    ({ month, opening: null, losses: null, retained: null, churnRate: null, retentionRate: null, unavailable });
  const monthPattern = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/;
  if (!monthPattern.test(filters.startMonth) || !monthPattern.test(filters.endMonth)
    || filters.startMonth > filters.endMonth
    || filters.endMonth > shiftMonth(filters.startMonth, 35)) {
    return { ...empty('', ['Choose an ordered range of at most 36 complete months.']), months, lostPlayers, tenure, divisions, unit: 'player-month opening opportunities' };
  }
  const locations = data.locations.filter(l => !filters.locationId || l.id === filters.locationId);
  const membershipGroups = new Map<string, MembershipEvidence[]>();
  for (const e of data.memberships) {
    const key = `${e.tenant_id}:${e.kid_id}:${e.membership_id}`;
    membershipGroups.set(key, [...(membershipGroups.get(key) ?? []), e]);
  }
  const players = new Map<string, MembershipEvidence[][]>();
  for (const rows of membershipGroups.values()) {
    const key = `${rows[0].tenant_id}:${rows[0].kid_id}`;
    players.set(key, [...(players.get(key) ?? []), rows]);
  }
  for (let month = filters.startMonth; month <= filters.endMonth; month = shiftMonth(month, 1)) {
    const issues = [...data.issues];
    if (!locations.length) issues.push('No authorized location selected.');
    // Fail closed for missing attribution: do not silently drop players from denominators.
    const selectedTenants = new Set(locations.map(l => l.tenant_id));
    const signatures = new Set<string>();
    const governingPolicies = new Map<string, RetentionPolicy>();
    for (const tenantId of selectedTenants) {
      const coverage = data.coverage.find(c => c.tenant_id === tenantId);
      for (const l of locations.filter(l => l.tenant_id === tenantId)) {
        // Select the governing version before checking supported semantics.
        // Never resurrect an older supported policy after it is superseded.
        const p = data.policies.filter(x => x.tenant_id === tenantId)
          .map(x => x.policy).filter(x => dateValue(x.effectiveFrom) <= monthBoundary(month, l.timezone))
          .sort((a, b) => dateValue(b.effectiveFrom) - dateValue(a.effectiveFrom))[0];
        if (!validPolicy(p)) issues.push('Approved cohort, lifecycle, location and privacy policy unavailable.');
        else {
          governingPolicies.set(l.id, p);
          signatures.add(JSON.stringify([p.entity, p.loss, p.pauses, p.expiry, p.reactivation, p.transfer,
            p.location, p.cancellationDate, p.timezone, p.segments, p.tenure, p.privacy]));
        }
        if (!coverage || dateValue(coverage.started_at) > monthBoundary(month, l.timezone)) issues.push('Insufficient historical lifecycle evidence for the opening cohort.');
        if (monthBoundary(shiftMonth(month, 1), l.timezone) > dateValue(data.asOf)) issues.push('Only completed local calendar months are available.');
      }
    }
    if (signatures.size > 1) issues.push('Selected tenants have incompatible cohort policies; a shared network denominator is unavailable.');
    let opening = 0;
    const monthLosses: RetentionReport['lostPlayers'] = [];
    const allocations: Array<{ band: string; division: string; lost: boolean }> = [];
    if (!issues.length) for (const [playerKey, groups] of players) {
      const [tenantId, kidId] = playerKey.split(':');
      if (!selectedTenants.has(tenantId)) continue;
      const playerSegments = data.segments.filter(s => s.tenant_id === tenantId && s.kid_id === kidId);
      // Evaluate in every authorized location timezone; opening attribution is frozen.
      const candidates = locations.filter(l => l.tenant_id === tenantId).flatMap(location => {
        const start = monthBoundary(month, location.timezone);
        const segment = latest(playerSegments, start - 1);
        return segment?.location_id === location.id ? [{ location, segment, start }] : [];
      });
      if (!candidates.length) {
        // A selected-location report must still detect unknown attribution in its tenant.
        const tenantLocation = locations.find(l => l.tenant_id === tenantId)!;
        const start = monthBoundary(month, tenantLocation.timezone);
        const segment = latest(playerSegments, start - 1);
        const p = governingPolicies.get(tenantLocation.id);
        if (!segment?.location_id && p && groups.some(rows => eligible(latest(rows, start - 1), start - 1, p))) {
          issues.push('Opening location attribution unavailable for one or more players.');
        }
        continue;
      }
      if (candidates.length !== 1) { issues.push('Ambiguous opening location at timezone boundary.'); continue; }
      const { location, segment, start } = candidates[0];
      const end = monthBoundary(shiftMonth(month, 1), location.timezone);
      const policy = governingPolicies.get(location.id)!;
      const openingRows = groups.map(rows => latest(rows, start - 1)).filter(r => eligible(r, start - 1, policy)) as MembershipEvidence[];
      if (!openingRows.length || !matches(segment, filters)) continue;
      opening++;
      // Closing boundary is exclusive: an exit at next month's midnight belongs to next month.
      const closeAt = end - 1;
      const closingRows = groups.map(rows => latest(rows, closeAt));
      const retained = closingRows.some(r => eligible(r, closeAt, policy));
      const coverageAt = dateValue(data.coverage.find(c => c.tenant_id === tenantId)!.started_at);
      const knownTenure = observedSpellDays(groups, start - 1, coverageAt, policy);
      const band = tenureBand(knownTenure);
      allocations.push({ band, division: DIVISIONS.includes(segment.state.division ?? '') ? segment.state.division! : 'Unknown', lost: !retained });
      if (!retained) {
        const endings = closingRows.filter((r): r is MembershipEvidence => !!r).map(r => ({ row: r, end: exit(r) }))
          .filter((x): x is { row: MembershipEvidence; end: NonNullable<ReturnType<typeof exit>> } => !!x.end && x.end.at >= start && x.end.at < end)
          .sort((a, b) => b.end.at - a.end.at);
        const last = endings[0];
        if (!last || closingRows.some(r => r?.state.deleted)
          || (policy.pauses === 'excluded' && closingRows.some(r => r?.state.status === 'paused'))) {
          issues.push('A cohort exit has no approved cancellation/nonrenewal effective-date evidence.');
          continue;
        }
        monthLosses.push({
          key: `${month}:${playerKey}`, month, tenantId, kidId,
          name: data.scope === 'owner' ? data.names[playerKey] ?? null : null,
          locationId: location.id, effectiveAt: new Date(last.end.at).toISOString(),
          reason: last.end.reason, evidenceIds: endings.map(x => x.row.id),
        });
      }
    }
    if (issues.length) months.push(empty(month, [...new Set(issues)]));
    else {
      lostPlayers.push(...monthLosses);
      for (const a of allocations) {
        for (const b of [tenure.find(t => t.label === a.band)!, divisions.find(d => d.label === a.division)!]) {
          b.opening++; if (a.lost) b.losses++;
        }
      }
      const losses = monthLosses.length;
      months.push({ month, opening, losses, retained: opening - losses,
        churnRate: rate(losses, opening), retentionRate: rate(opening - losses, opening),
        unavailable: opening ? [] : ['Zero opening cohort; rates unavailable.'] });
    }
  }
  const incomplete = months.some(m => m.opening === null);
  const opening = incomplete ? null : months.reduce((sum, m) => sum + m.opening!, 0);
  const losses = incomplete ? null : months.reduce((sum, m) => sum + m.losses!, 0);
  for (const b of [...tenure, ...divisions]) b.churnRate = incomplete || b.label === TENURE_BANDS[5] ? null : rate(b.losses, b.opening);
  return {
    month: `${filters.startMonth} through ${filters.endMonth}`, months,
    opening, losses, retained: opening === null ? null : opening - losses!,
    churnRate: opening === null ? null : rate(losses!, opening),
    retentionRate: opening === null ? null : rate(opening - losses!, opening),
    unavailable: [...new Set(months.flatMap(m => m.unavailable))],
    lostPlayers: incomplete ? [] : lostPlayers, tenure: incomplete ? [] : tenure,
    divisions: incomplete ? [] : divisions, unit: 'player-month opening opportunities',
  };
}
