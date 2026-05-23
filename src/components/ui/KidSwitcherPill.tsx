/**
 * KidSwitcherPill — self-contained pill + sheet for switching the active kid.
 *
 * Renders nothing when the family has only one athlete. Drop into any screen
 * header to give parents a quick way to switch between siblings.
 */

import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useSelectedKid } from '@/hooks/useSelectedKid';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import KidSwitcherSheet from './KidSwitcherSheet';

export default function KidSwitcherPill() {
  const { kid, kids, setSelectedKid } = useSelectedKid();
  const [sheetVisible, setSheetVisible] = useState(false);

  if (!kid || kids.length <= 1) return null;

  return (
    <>
      <Pressable
        onPress={() => setSheetVisible(true)}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel={`Viewing ${kid.first_name}. Tap to switch athlete.`}
      >
        <Text style={styles.name} numberOfLines={1}>
          {kid.first_name.toUpperCase()}
        </Text>
        <ChevronDown size={14} color={colors.dark} strokeWidth={2.5} />
      </Pressable>

      <KidSwitcherSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        kids={kids}
        selectedKidId={kid.id}
        onSelect={(id) => {
          setSelectedKid(id);
          setSheetVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  name: {
    color: colors.dark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
  },
});
