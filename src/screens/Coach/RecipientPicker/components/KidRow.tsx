/**
 * Single-select row for a kid in the recipient picker. Renders an avatar
 * (or initials fallback), the kid's full name, age group meta, and a
 * radio-style indicator. Wrapped in TouchableOpacity so the whole card is
 * the hit target.
 */

import { Image, Text, TouchableOpacity, View } from 'react-native';

import type { TenantKid } from '@/api/coachMessages';

import { styles } from '../styles';

type Props = {
  kid: TenantKid;
  selected: boolean;
  onSelect: (kidId: string) => void;
};

function initialsOf(kid: TenantKid): string {
  const first = kid.firstName?.[0] ?? '';
  const last = kid.lastName?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

export default function KidRow({ kid, selected, onSelect }: Props) {
  const meta = kid.ageGroup ? kid.ageGroup : 'Age group not set';

  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${kid.firstName} ${kid.lastName}`}
      activeOpacity={0.85}
      style={[styles.row, selected && styles.rowSelected]}
      onPress={() => onSelect(kid.kidId)}
    >
      <View style={styles.avatar}>
        {kid.avatarUrl ? (
          <Image
            source={{ uri: kid.avatarUrl }}
            style={styles.avatarImage}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={styles.avatarInitials}>{initialsOf(kid)}</Text>
        )}
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowName} numberOfLines={1}>
          {kid.firstName} {kid.lastName}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </TouchableOpacity>
  );
}
