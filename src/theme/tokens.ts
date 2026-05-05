/**
 * Design tokens for Ballpark.
 *
 * Source of truth: docs/DESIGN.md sections 2-5.
 * NEVER hardcode colors, spacing, radius, fonts, or font sizes in components.
 * Always import from `@/theme`.
 */

export const colors = {
  // Primary darks (backgrounds)
  dark: '#2D2B2A',
  darker: '#1C1B1A',
  darkest: '#0F0E0E',

  // Gold accents (Infinite Hitting signature)
  gold: '#F1E5AD',
  goldBright: '#E8D89A',
  goldDeep: '#B8A268',
  goldHover: '#D9C88F',

  // Cream (light backgrounds when needed)
  cream: '#FAF6E8',
  creamLight: '#FDFBF2',

  // Pure
  white: '#FFFFFF',

  // Text
  text: '#1A1A1A',
  textOnDark: '#FAF6E8',
  textMuted: '#6B6560',
  textLight: '#9B9590',

  // Borders
  border: '#3A3836',
  borderLight: '#E8E3D5',
  borderGold: 'rgba(241, 229, 173, 0.2)',

  // Status colors
  success: '#A8C67F',
  successBg: '#E8F0DC',
  warning: '#E8A747',
  warningBg: '#F9EDD5',
  danger: '#C86B5C',
  dangerBg: '#F5DED8',
  info: '#7BA8C4',
  infoBg: '#D8E6EF',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 6,
  base: 8,
  md: 10,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 20,
  '4xl': 24,
  '5xl': 32,
  '6xl': 40,
  '7xl': 48,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  base: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 14,
  '3xl': 16,
  '4xl': 18,
  '5xl': 20,
  full: 9999,
} as const;

export const fontSizes = {
  xs: 9,
  sm: 10,
  base: 12,
  md: 13,
  lg: 14,
  xl: 17,
  '2xl': 22,
  '3xl': 28,
  '4xl': 32,
  '5xl': 44,
  '6xl': 48,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/**
 * Logical font family names for design reference.
 *
 * IMPORTANT: React Native does NOT pick the right cut from `fontWeight` when
 * using `@expo-google-fonts/*` — each weight is a separate font family at the
 * native level (e.g. `Oswald_700Bold`, `Inter_500Medium`). Use the
 * `fontFamilies` map below in `style.fontFamily` to pick a specific weight,
 * and only set `fontWeight` as a stylistic hint for fallback fonts.
 *
 * Mono is declared here for design reference but not loaded yet (deferred to
 * v0.5 when redemption codes ship).
 */
export const fonts = {
  display: 'Oswald',
  body: 'Inter',
  mono: 'JetBrains Mono',
} as const;

/**
 * Concrete font family names registered via expo-font.
 * Use these directly in `style.fontFamily`.
 */
export const fontFamilies = {
  oswaldRegular: 'Oswald_400Regular',
  oswaldMedium: 'Oswald_500Medium',
  oswaldSemiBold: 'Oswald_600SemiBold',
  oswaldBold: 'Oswald_700Bold',
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
  interExtraBold: 'Inter_800ExtraBold',
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type FontSizes = typeof fontSizes;
export type FontWeights = typeof fontWeights;
export type Fonts = typeof fonts;
export type FontFamilies = typeof fontFamilies;
