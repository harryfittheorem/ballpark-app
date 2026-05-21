export const brand = {
  dark: '#2D2B2A',
  darker: '#1C1B1A',
  darkest: '#0F0E0E',
  gold: '#F1E5AD',
  goldBright: '#E8D89A',
  goldDeep: '#B8A268',
  goldHover: '#D9C88F',
  cream: '#FAF6E8',
  creamLight: '#FDFBF2',
  white: '#FFFFFF',
  text: '#FAF6E8',
  textMuted: '#8B8580',
  textLight: '#9B9590',
  border: '#3A3836',
  borderStrong: '#4A4846',
  borderDark: '#3A3836',
  surface: '#2D2B2A',
  surfaceAlt: '#1C1B1A',
  success: '#6BAA4A',
  successBg: '#1E2E16',
  warning: '#D4941A',
  warningBg: '#2E2210',
  danger: '#CC5444',
  dangerBg: '#2E1410',
  info: '#4A8BAA',
  infoBg: '#102030',
} as const;

export const fonts = {
  display: "'Oswald', 'Bebas Neue', Impact, sans-serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', Menlo, monospace",
} as const;

export type BrandColor = keyof typeof brand;
