import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

import { dayOfWeekUtc } from '../utils/availability';

type Props = {
  range: string[];
  today: string;
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelect: (ymd: string) => void;
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type Cell =
  | { kind: 'pad'; key: string }
  | {
      kind: 'day';
      key: string;
      ymd: string;
      day: number;
      inRange: boolean;
      available: boolean;
      isToday: boolean;
      isSelected: boolean;
    };

type MonthGroup = {
  key: string;
  label: string;
  cells: Cell[];
};

function buildMonths(
  range: string[],
  today: string,
  availableDates: Set<string>,
  selectedDate: string | null,
): MonthGroup[] {
  if (range.length === 0) return [];
  const inRange = new Set(range);
  const first = range[0]!;
  const last = range[range.length - 1]!;
  const [fy, fm] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);

  const months: MonthGroup[] = [];
  let y = fy;
  let m = fm;
  while (y < ly || (y === ly && m <= lm)) {
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const firstDow = dayOfWeekUtc(`${monthKey}-01`);

    const cells: Cell[] = [];
    for (let i = 0; i < firstDow; i++) {
      cells.push({ kind: 'pad', key: `${monthKey}-pad-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const ymd = `${monthKey}-${String(day).padStart(2, '0')}`;
      cells.push({
        kind: 'day',
        key: ymd,
        ymd,
        day,
        inRange: inRange.has(ymd),
        available: availableDates.has(ymd),
        isToday: ymd === today,
        isSelected: ymd === selectedDate,
      });
    }
    months.push({
      key: monthKey,
      label: `${MONTH_LABELS[m - 1]} ${y}`,
      cells,
    });

    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export default function Calendar({
  range,
  today,
  availableDates,
  selectedDate,
  onSelect,
}: Props) {
  const months = useMemo(
    () => buildMonths(range, today, availableDates, selectedDate),
    [range, today, availableDates, selectedDate],
  );

  return (
    <View style={styles.container}>
      {months.map((month) => (
        <View key={month.key} style={styles.month}>
          <Text style={styles.monthLabel}>{month.label}</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, idx) => (
              <View key={`${month.key}-w-${idx}`} style={styles.cell}>
                <Text style={styles.weekdayText}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.grid}>
            {month.cells.map((cell) => {
              if (cell.kind === 'pad') {
                return <View key={cell.key} style={styles.cell} />;
              }
              const tappable = cell.inRange && cell.available && !cell.isSelected;
              return (
                <View key={cell.key} style={styles.cell}>
                  <Pressable
                    disabled={!cell.inRange || !cell.available}
                    onPress={() => onSelect(cell.ymd)}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: cell.isSelected,
                      disabled: !cell.inRange || !cell.available,
                    }}
                    accessibilityLabel={`${cell.ymd}${cell.available ? '' : ', unavailable'}${cell.isToday ? ', today' : ''}`}
                    style={({ pressed }) => [
                      styles.day,
                      cell.available && cell.inRange && styles.dayAvailable,
                      cell.isToday && styles.dayToday,
                      cell.isSelected && styles.daySelected,
                      pressed && tappable && styles.dayPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        (!cell.inRange || !cell.available) && styles.dayTextDim,
                        cell.available && cell.inRange && styles.dayTextAvailable,
                        cell.isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const CELL_PERCENT = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  container: {
    gap: spacing['2xl'],
  },
  month: {
    gap: spacing.base,
  },
  monthLabel: {
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_PERCENT,
    aspectRatio: 1,
    padding: 2,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    letterSpacing: tracking.wide,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayAvailable: {
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(241, 229, 173, 0.06)',
  },
  dayToday: {
    borderColor: colors.gold,
  },
  daySelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  dayPressed: {
    backgroundColor: 'rgba(241, 229, 173, 0.18)',
  },
  dayText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.base,
    color: colors.textOnDark,
  },
  dayTextDim: {
    color: colors.textMuted,
    opacity: 0.45,
  },
  dayTextAvailable: {
    color: colors.gold,
    fontFamily: fontFamilies.interSemiBold,
  },
  dayTextSelected: {
    color: colors.darkest,
    fontFamily: fontFamilies.interBold,
  },
});
