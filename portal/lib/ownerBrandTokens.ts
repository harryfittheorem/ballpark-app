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
  text: '#1A1A1A',
  textMuted: '#6B6560',
  textLight: '#9B9590',
  border: '#E8E3D5',
  borderStrong: '#D4CEBE',
  borderDark: '#3A3836',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F0E0',
  success: '#5B8A3A',
  successBg: '#E8F0DC',
  warning: '#C48420',
  warningBg: '#F9EDD5',
  danger: '#B84A3A',
  dangerBg: '#F5DED8',
  info: '#3A6B8A',
  infoBg: '#D8E6EF',
} as const;

export const fonts = {
  display: "'Oswald', 'Bebas Neue', Impact, sans-serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', Menlo, monospace",
} as const;

export type BrandColor = keyof typeof brand;
