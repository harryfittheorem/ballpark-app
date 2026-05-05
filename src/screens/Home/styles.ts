import { StyleSheet } from 'react-native';

import { colors, spacing } from '@/theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.darkest,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
  },
  section: {
    marginBottom: spacing['3xl'],
  },
});
