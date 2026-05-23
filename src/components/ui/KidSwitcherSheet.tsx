/**
 * KidSwitcherSheet — bottom sheet modal for selecting the active kid.
 *
 * Shows all kids in the family as tappable rows, plus an "Add Another
 * Athlete" row at the bottom. Opening/closing is controlled by the
 * parent via `visible` + `onClose`.
 */

import { Check, ChevronRight, UserPlus, X } from 'lucide-react-native';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import type { Tables } from '@/types/database';

type Kid = Tables<'kids'>;

type Props = {
  visible: boolean;
  kids: Kid[];
  selectedKidId: string | null;
  onSelect: (id: string) => void;
  onAddAthlete?: () => void;
  onClose: () => void;
};

export default function KidSwitcherSheet({
  visible,
  kids,
  selectedKidId,
  onSelect,
  onAddAthlete,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>SELECT ATHLETE</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color={colors.textLight} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {kids.map((kid) => {
              const isSelected = kid.id === selectedKidId;
              const initial = (kid.first_name?.[0] ?? '?').toUpperCase();
              const fullName = `${kid.first_name} ${kid.last_name ?? ''}`.trim();
              const meta = [kid.age_group, kid.primary_position]
                .filter(Boolean)
                .join(' · ');
              return (
                <Pressable
                  key={kid.id}
                  onPress={() => {
                    onSelect(kid.id);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.kidRow,
                    isSelected && styles.kidRowSelected,
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={fullName}
                >
                  <View
                    style={[styles.avatar, isSelected && styles.avatarSelected]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        isSelected && styles.avatarTextSelected,
                      ]}
                    >
                      {initial}
                    </Text>
                  </View>
                  <View style={styles.kidInfo}>
                    <Text
                      style={[
                        styles.kidName,
                        isSelected && styles.kidNameSelected,
                      ]}
                    >
                      {fullName}
                    </Text>
                    {meta ? (
                      <Text style={styles.kidMeta}>{meta}</Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Check size={18} color={colors.gold} strokeWidth={2.5} />
                  ) : (
                    <ChevronRight size={18} color={colors.textMuted} />
                  )}
                </Pressable>
              );
            })}

            {onAddAthlete ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onAddAthlete();
                }}
                style={({ pressed }) => [
                  styles.addRow,
                  pressed && { opacity: 0.75 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Add another athlete"
              >
                <View style={styles.addIcon}>
                  <UserPlus size={18} color={colors.gold} />
                </View>
                <Text style={styles.addText}>Add Another Athlete</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.darker,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderGold,
    paddingBottom: spacing['6xl'],
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.base,
    letterSpacing: tracking.wider,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  list: {},
  listContent: {
    padding: spacing['2xl'],
    gap: spacing.sm,
  },
  kidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark,
  },
  kidRowSelected: {
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(232,167,71,0.06)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarSelected: {
    backgroundColor: colors.gold,
  },
  avatarText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.textLight,
  },
  avatarTextSelected: {
    color: colors.dark,
  },
  kidInfo: {
    flex: 1,
  },
  kidName: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  kidNameSelected: {
    color: colors.gold,
  },
  kidMeta: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginTop: spacing.sm,
  },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(232,167,71,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
    letterSpacing: tracking.wide,
  },
});
