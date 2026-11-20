/**
 * Sessions sub-tab — staff mobile check-in board.
 *
 * Today's bookings are grouped into "sessions" (same scheduled_start +
 * coach_id). Each session renders as a tappable card that expands to reveal
 * the full roster. Each roster row shows:
 *   • Kid name
 *   • Membership status badge
 *   • Pending assignment count
 *   • Check-in status: timestamp (primary) or Check-In / No-Show buttons
 *
 * A 5-minute Undo button appears below the timestamp when a check-in is
 * still reversible, so the timestamp is always the first thing shown.
 *
 * Supabase Realtime in useStaffSessions keeps the roster live so concurrent
 * portal check-ins appear within a few seconds.
 */

import { CheckCircle, ChevronDown, ChevronUp, RotateCcw, UserCircle, XCircle } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useCoach } from '@/hooks/useCoach';
import { isWithinUndoWindow, useStaffSessions, type StaffBookingWithPending } from '@/hooks/useStaffSessions';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';
import { getCheckInInstructors, correctBookingInstructor, type CheckInInstructor } from '@/api/bookings';

// ─── Time formatting ──────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const min = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return min === 0
    ? `${h12}:00 ${ampm}`
    : `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

// ─── Session grouping ─────────────────────────────────────────────────────────

type SessionGroup = {
  key: string; // `${scheduled_start}__${coach_id ?? 'none'}`
  scheduled_start: string;
  coach_first_name: string | null;
  coach_last_name: string | null;
  session_type_name: string | null;
  cage_number: string | null;
  bookings: StaffBookingWithPending[];
};

function groupIntoSessions(bookings: StaffBookingWithPending[]): SessionGroup[] {
  const map = new Map<string, SessionGroup>();

  for (const b of bookings) {
    const key = `${b.scheduled_start}__${b.coach_id ?? 'none'}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        scheduled_start: b.scheduled_start,
        coach_first_name: b.coach_first_name,
        coach_last_name: b.coach_last_name,
        session_type_name: b.session_type_name,
        cage_number: b.cage_number,
        bookings: [],
      });
    }
    map.get(key)!.bookings.push(b);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
  );
}

// ─── Membership badge ─────────────────────────────────────────────────────────

function MembershipBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { color: string; bg: string; label: string }> = {
    active:   { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Member' },
    paused:   { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'Paused' },
    cancelled: { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Cancelled' },
  };
  const s = map[status] ?? { color: colors.textLight, bg: 'transparent', label: status };
  return (
    <View style={[badgeStyles.badge, { backgroundColor: s.bg, borderColor: s.color }]}>
      <Text style={[badgeStyles.text, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  text: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

// ─── Roster row ───────────────────────────────────────────────────────────────

type RosterRowProps = {
  booking: StaffBookingWithPending;
  onAction: (action: 'checkin' | 'noshow' | 'undo' | 'refresh', id: string, actualCoachId?: string) => void;
};

function RosterRow({ booking: b, onAction }: RosterRowProps) {
  const [instructors, setInstructors] = useState<CheckInInstructor[]>([]);
  const [actualCoachId, setActualCoachId] = useState('');
  const [reason, setReason] = useState('');
  const [instructorError, setInstructorError] = useState('');
  const [correcting, setCorrecting] = useState(false);
  useEffect(() => {
    let active = true;
    getCheckInInstructors(b.location_id).then(rows => { if (active) setInstructors(rows); })
      .catch(error => { if (active) setInstructorError(error.message ?? 'Instructors unavailable.'); });
    return () => { active = false; };
  }, [b.location_id]);
  const canUndo = isWithinUndoWindow(b);
  const isPending = !!b.pending || correcting;
  const isActionable = b.status === 'confirmed' || b.status === 'pending';
  const kidName = [b.kid_first_name, b.kid_last_name].filter(Boolean).join(' ') || 'Unknown';

  return (
    <View style={rosterStyles.row}>
      {/* Top: avatar + name + status */}
      <View style={rosterStyles.topRow}>
        <View style={rosterStyles.avatar}>
          <UserCircle size={18} color={colors.gold} strokeWidth={1.5} />
        </View>
        <View style={rosterStyles.info}>
          <View style={rosterStyles.nameRow}>
            <Text style={rosterStyles.name} numberOfLines={1}>{kidName}</Text>
            <MembershipBadge status={b.membership_status} />
          </View>
          {b.pending_assignment_count > 0 && (
            <Text style={rosterStyles.assignBadge}>
              {b.pending_assignment_count} pending drill{b.pending_assignment_count !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Inline status for completed / no-show */}
        {b.status === 'completed' && b.attended_at && (
          <View style={rosterStyles.arrivedRow}>
            <CheckCircle size={12} color="#34D399" />
            <Text style={rosterStyles.arrivedTime}>{formatTime(b.attended_at)}</Text>
          </View>
        )}
        {b.status === 'no_show' && (
          <Text style={rosterStyles.noShowLbl}>No show</Text>
        )}
      </View>

      <Text style={{ color: colors.textLight }}>
        Actual instructor: {[b.actual_coach_first_name,b.actual_coach_last_name].filter(Boolean).join(' ') || 'Not recorded'}
      </Text>
      {b.type_category !== 'cage' && (isActionable || (b.status === 'completed' && b.can_correct_instructor)) && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.textLight }}>Choose actual instructor</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {instructors.map(c => <Pressable key={c.id} disabled={isPending}
              accessibilityRole="radio" accessibilityState={{ checked: actualCoachId === c.id }}
              onPress={() => setActualCoachId(c.id)}
              style={{ padding: 10, borderWidth: 1, borderColor: actualCoachId === c.id ? colors.gold : colors.border, borderRadius: 6 }}>
              <Text style={{ color: colors.cream }}>{[c.first_name,c.last_name].filter(Boolean).join(' ')}</Text>
            </Pressable>)}
          </View>
          {instructors.length === 0 && <Text style={{ color: colors.textLight }}>No eligible instructors available.</Text>}
          {b.status === 'completed' && b.can_correct_instructor && <>
            <TextInput value={reason} onChangeText={setReason} placeholder="Reason for instructor correction" placeholderTextColor={colors.textLight}
              accessibilityLabel="Reason for instructor correction" style={{ color: colors.cream, padding: 10, borderColor: colors.border, borderWidth: 1 }} />
            <Pressable disabled={isPending || !actualCoachId || actualCoachId === b.actual_coach_id || !reason.trim()}
              onPress={async () => {
                setCorrecting(true); setInstructorError('');
                try { await correctBookingInstructor(b.id, actualCoachId, reason); setReason(''); onAction('refresh', b.id); }
                catch (error) { setInstructorError(error instanceof Error ? error.message : 'Correction failed.'); }
                finally { setCorrecting(false); }
              }}><Text style={{ color: colors.gold }}>{correcting ? 'Saving…' : 'Correct instructor'}</Text></Pressable>
          </>}
          {!!instructorError && <Text accessibilityRole="alert" style={{ color: '#F87171' }}>{instructorError}</Text>}
        </View>
      )}

      {/* Bottom: full-width action buttons */}
      {isActionable && (
        <View style={rosterStyles.actionRow}>
          <Pressable
            style={[rosterStyles.actionBtn, rosterStyles.btnGreen]}
            disabled={isPending || (b.type_category !== 'cage' && !actualCoachId)}
            onPress={() => onAction('checkin', b.id, actualCoachId)}
            accessibilityLabel={`Check in ${kidName}`}
            accessibilityRole="button"
          >
            {b.pending === 'checkin'
              ? <ActivityIndicator size="small" color="#34D399" />
              : <><CheckCircle size={13} color="#34D399" /><Text style={[rosterStyles.actionBtnTxt, rosterStyles.txtGreen]}>Check In</Text></>}
          </Pressable>
          <Pressable
            style={[rosterStyles.actionBtn, rosterStyles.btnRed]}
            disabled={isPending}
            onPress={() => onAction('noshow', b.id)}
            accessibilityLabel={`Mark ${kidName} no-show`}
            accessibilityRole="button"
          >
            {b.pending === 'noshow'
              ? <ActivityIndicator size="small" color="#F87171" />
              : <><XCircle size={13} color="#F87171" /><Text style={[rosterStyles.actionBtnTxt, rosterStyles.txtRed]}>No Show</Text></>}
          </Pressable>
        </View>
      )}

      {/* Undo row for completed bookings within 5-min window */}
      {b.status === 'completed' && canUndo && (
        <View style={rosterStyles.undoRow}>
          <Pressable
            style={[rosterStyles.actionBtn, rosterStyles.btnUndo]}
            disabled={isPending}
            onPress={() => onAction('undo', b.id)}
            accessibilityLabel={`Undo check-in for ${kidName}`}
            accessibilityRole="button"
          >
            {b.pending === 'undo'
              ? <ActivityIndicator size="small" color={colors.textLight} />
              : <><RotateCcw size={12} color={colors.textLight} /><Text style={[rosterStyles.actionBtnTxt, rosterStyles.txtUndo]}>Undo Check-In</Text></>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const rosterStyles = StyleSheet.create({
  row: {
    flexDirection: 'column',
    paddingVertical: spacing['2xl'],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darkest,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: {
    color: colors.cream,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
  },
  assignBadge: {
    color: colors.gold,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  undoRow: {
    flexDirection: 'row',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionBtnTxt: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.sm,
  },
  btnGreen: { borderColor: '#065f46', backgroundColor: 'rgba(6,78,59,0.3)' },
  btnRed: { borderColor: '#7f1d1d', backgroundColor: 'rgba(127,29,29,0.2)' },
  btnUndo: { borderColor: colors.border, backgroundColor: colors.darkest },
  txtGreen: { color: '#34D399' },
  txtRed: { color: '#F87171' },
  txtUndo: { color: colors.textLight },
  arrivedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  arrivedTime: {
    color: '#34D399',
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
  },
  noShowLbl: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    fontStyle: 'italic',
    flexShrink: 0,
  },
});

// ─── Session card ─────────────────────────────────────────────────────────────

type SessionCardProps = {
  session: SessionGroup;
  onAction: (action: 'checkin' | 'noshow' | 'undo' | 'refresh', id: string, actualCoachId?: string) => void;
};

function SessionCard({ session, onAction }: SessionCardProps) {
  const [expanded, setExpanded] = useState(true);

  const checkedInCount = session.bookings.filter((b) => b.status === 'completed').length;
  const total = session.bookings.length;
  const allDone = checkedInCount === total;
  const coachName = [session.coach_first_name, session.coach_last_name].filter(Boolean).join(' ');

  return (
    <View style={cardStyles.card}>
      {/* Session header — tappable to expand/collapse */}
      <Pressable
        style={cardStyles.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${formatTime(session.scheduled_start)} session with ${coachName || 'coach'}, ${total} athlete${total !== 1 ? 's' : ''}`}
        accessibilityState={{ expanded }}
      >
        <View style={cardStyles.headerLeft}>
          <Text style={cardStyles.time}>{formatTime(session.scheduled_start)}</Text>
          <View style={cardStyles.headerMeta}>
            {coachName ? <Text style={cardStyles.metaText}>{coachName}</Text> : null}
            {session.session_type_name ? (
              <Text style={cardStyles.metaText}>· {session.session_type_name}</Text>
            ) : null}
            {session.cage_number ? (
              <Text style={cardStyles.metaText}>· Cage {session.cage_number}</Text>
            ) : null}
          </View>
        </View>
        <View style={cardStyles.headerRight}>
          <View style={[cardStyles.countBadge, allDone && cardStyles.countBadgeDone]}>
            <Text style={[cardStyles.countText, allDone && cardStyles.countTextDone]}>
              {checkedInCount}/{total}
            </Text>
          </View>
          {expanded
            ? <ChevronUp size={16} color={colors.textLight} />
            : <ChevronDown size={16} color={colors.textLight} />}
        </View>
      </Pressable>

      {/* Roster */}
      {expanded && (
        <View style={cardStyles.roster}>
          {session.bookings.map((b) => (
            <RosterRow key={b.id} booking={b} onAction={onAction} />
          ))}
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.darker,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing['2xl'],
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing['2xl'],
    gap: spacing.lg,
  },
  headerLeft: { flex: 1, gap: 3 },
  time: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexShrink: 0 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darkest,
  },
  countBadgeDone: { borderColor: '#065f46', backgroundColor: 'rgba(6,78,59,0.2)' },
  countText: {
    color: colors.textLight,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
  },
  countTextDone: { color: '#34D399' },
  roster: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing.lg,
  },
});

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { msg: string; ok: boolean } | null;

function Toast({ toast }: { toast: ToastState }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      return;
    }
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [toast, opacity]);

  if (!toast) return null;

  return (
    <Animated.View
      style={[
        toastStyles.toast,
        toast.ok ? toastStyles.ok : toastStyles.err,
        { opacity, pointerEvents: 'none' },
      ]}
    >
      {toast.ok
        ? <CheckCircle size={14} color="#34D399" />
        : <XCircle size={14} color="#F87171" />}
      <Text style={[toastStyles.msg, toast.ok ? toastStyles.msgOk : toastStyles.msgErr]}>
        {toast.msg}
      </Text>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: spacing['4xl'],
    left: spacing['3xl'],
    right: spacing['3xl'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing['2xl'],
    borderRadius: radius.lg,
    borderWidth: 1,
    zIndex: 100,
  },
  ok: { backgroundColor: 'rgba(6,78,59,0.9)', borderColor: '#065f46' },
  err: { backgroundColor: 'rgba(127,29,29,0.9)', borderColor: '#7f1d1d' },
  msg: { fontFamily: fontFamilies.interMedium, fontSize: fontSizes.sm, flex: 1 },
  msgOk: { color: '#6EE7B7' },
  msgErr: { color: '#FCA5A5' },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function SessionsBody() {
  const { appRole } = useAuth();
  const { coach } = useCoach();

  const isCoach = appRole === 'coach';
  const coachId = isCoach ? (coach?.id ?? undefined) : undefined;

  const { bookings, isPending, isError, error, refetch, mutate } = useStaffSessions(coachId, isCoach);

  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleAction = useCallback(
    async (action: 'checkin' | 'noshow' | 'undo' | 'refresh', bookingId: string, actualCoachId?: string) => {
      if (action === 'refresh') { await refetch(); return; }
      const result = await mutate(action, bookingId, actualCoachId);
      if (!result.ok) {
        showToast(result.message, false);
      } else {
        const labels: Record<string, string> = {
          checkin: 'Checked in!',
          noshow: 'Marked no-show.',
          undo: 'Check-in undone.',
        };
        showToast(labels[action] ?? 'Done.', true);
      }
    },
    [mutate, showToast, refetch],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  const sessions = groupIntoSessions(bookings);

  if (isPending) {
    return (
      <View style={bodyStyles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={bodyStyles.center}>
        <Text style={bodyStyles.errorText}>
          {error instanceof Error ? error.message : 'Failed to load sessions.'}
        </Text>
        <Pressable style={bodyStyles.retryBtn} onPress={() => void refetch()}>
          <Text style={bodyStyles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={bodyStyles.emptyContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={colors.gold} colors={[colors.gold]} />
        }
      >
        <Text style={bodyStyles.emptyText}>No sessions scheduled for today.</Text>
      </ScrollView>
    );
  }

  return (
    <View style={bodyStyles.root}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.key}
        contentContainerStyle={bodyStyles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={colors.gold} colors={[colors.gold]} />
        }
        renderItem={({ item }) => (
          <SessionCard session={item} onAction={handleAction} />
        )}
      />
      <Toast toast={toast} />
    </View>
  );
}

const bodyStyles = StyleSheet.create({
  root: { flex: 1 },
  list: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['5xl'],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2xl'],
    padding: spacing['3xl'],
  },
  errorText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  retryText: {
    color: colors.gold,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.sm,
    textTransform: 'uppercase',
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['5xl'],
  },
  emptyText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
});
