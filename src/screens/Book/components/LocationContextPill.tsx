/**
 * LocationContextPill — shown in the Book tab header when the active
 * location is known.
 *
 * When allow_cross_location_booking = false (the default): renders a
 * non-interactive read-only pill showing the current location name.
 *
 * When allow_cross_location_booking = true: renders a tappable pill that
 * opens a bottom-sheet picker so the user can switch context for this
 * session without changing their primary location.
 */

import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import type { Location } from '@/api/bookings';

type Props = {
  locationName: string | null;
  allowSwitch: boolean;
  allLocations: Location[];
  onSelect: (locationId: string) => void;
};

export default function LocationContextPill({
  locationName,
  allowSwitch,
  allLocations,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!locationName) return null;

  const pill = (
    <View style={styles.pill}>
      <MapPin size={12} color={colors.gold} />
      <Text style={styles.pillText} numberOfLines={1}>
        {locationName.toUpperCase()}
      </Text>
      {allowSwitch && <Text style={styles.chevron}>▾</Text>}
    </View>
  );

  if (!allowSwitch) return pill;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel={`Active location: ${locationName}. Tap to switch.`}
      >
        {pill}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>SELECT LOCATION</Text>
            {allLocations.map((loc) => (
              <Pressable
                key={loc.id}
                onPress={() => {
                  onSelect(loc.id);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.locationRow,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={styles.locationName}>{loc.name}</Text>
                {loc.city ? (
                  <Text style={styles.locationSub}>
                    {loc.city}, {loc.state ?? ''}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(241,229,173,0.1)',
    borderWidth: 1,
    borderColor: colors.borderGold,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  pillText: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wider,
    maxWidth: 180,
  },
  chevron: {
    color: colors.gold,
    fontSize: fontSizes.xs,
    lineHeight: 14,
  },

  // Modal
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor: colors.darkest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderGold,
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['4xl'],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  sheetTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    letterSpacing: tracking.wider,
    color: colors.gold,
    marginBottom: spacing['2xl'],
  },
  locationRow: {
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  locationName: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
  },
  locationSub: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    marginTop: 2,
  },
});
