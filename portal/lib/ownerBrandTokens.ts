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
  textMuted: '#A8A3A0',
  textLight: '#B0ABA8',
  border: '#3A3836',
  borderStrong: '#4A4846',
  borderDark: '#3A3836',
  surface: '#2D2B2A',
  surfaceAlt: '#1C1B1A',
  success: '#a8c67f',
  successBg: 'rgba(168,198,127,0.12)',
  warning: '#e8a747',
  warningBg: 'rgba(232,167,71,0.12)',
  danger: '#c86b5c',
  dangerBg: 'rgba(200,107,92,0.12)',
  info: '#7ba8c4',
  infoBg: 'rgba(123,168,196,0.12)',
} as const;

export const fonts = {
  display: "'Oswald', 'Bebas Neue', Impact, sans-serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', Menlo, monospace",
} as const;

export type BrandColor = keyof typeof brand;
