# Design System & Visual Spec

> This document defines the visual design language for the Ballpark athlete app. Every screen, component, and interaction should follow these rules. The authoritative visual reference is `/design/InfiniteHittingApp.jsx` — when in doubt, look there.

---

## 1. Brand Identity

**Tenant:** Infinite Hitting (initial)
**Aesthetic:** Premium athletic, dark luxe, gold accents
**Tone:** Aspirational but accessible. Treats kids as serious athletes, not children.

The visual language is closer to a high-end sports brand (Nike, Adidas, Under Armour) than to typical SaaS apps (MindBody, Mindbody). We're competing for the kid's attention against TikTok and Instagram, not against scheduling software.

---

## 2. Color Tokens

### Primary palette

```typescript
// /src/theme/tokens.ts

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
};
```

### Usage rules

- **Default background** is always one of the dark tones (`darkest`, `darker`, or `dark`)
- **Gold is for attention** — points cards, primary CTAs, highlights, current state
- **Cream is for inverted contexts** — modals, light surfaces, alternative cards
- **Status colors** are for badges, chips, alerts only — never primary surfaces

---

## 3. Typography

```typescript
// /src/theme/tokens.ts

export const fonts = {
  display: 'Oswald',         // headers, big numbers, button labels
  body: 'Inter',             // body text, descriptions, long-form content
  mono: 'JetBrains Mono',    // codes, IDs, redemption codes
};

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
};

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};
```

### Typography rules

- **Display (Oswald)** is for: headlines, big numbers (points, exit velo), button labels, navigation tabs, section labels
- **Body (Inter)** is for: descriptions, paragraphs, list items, secondary text
- **Mono (JetBrains Mono)** is for: redemption codes, transaction IDs, anything that needs to be visually copyable

### Letter spacing

- Display headers (Oswald): `letterSpacing: -0.5` to `-1` for big sizes
- All-caps section labels: `letterSpacing: 1.5` to `2`
- Body text: `letterSpacing: 0` (default)

### Font setup in Expo

```typescript
// In App.tsx, load fonts before app renders:
import { useFonts } from 'expo-font';
import {
  Oswald_400Regular,
  Oswald_500Medium,
  Oswald_600SemiBold,
  Oswald_700Bold,
} from '@expo-google-fonts/oswald';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
```

---

## 4. Spacing Scale

```typescript
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
};
```

**Rule:** Always reference spacing via the scale. Never use arbitrary numbers. If `spacing.lg` (12px) doesn't fit, use the next step up or down — don't introduce 11px or 13px.

---

## 5. Border Radius

```typescript
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
};
```

### Usage
- **Buttons:** `radius.md` (8px) for secondary, `radius.xl` (12px) for primary
- **Cards:** `radius.2xl` (14px) standard, `radius.5xl` (20px) for hero cards
- **Pills/chips:** `radius.full`
- **Phone screen container:** `radius.5xl` (20px) on inner content

---

## 6. Component Patterns

These are the recurring component patterns. Build each as a reusable component in `/src/components`.

### Section Label

```
"NEW FROM COACH" / gold / 10pt / 700 weight / 2pt letter-spacing / uppercase
```

**Component:** `<SectionLabel>NEW FROM COACH</SectionLabel>` — optionally with `action` prop for "See all →" link

### Card (default dark)

```
background: colors.darker
borderRadius: radius.2xl (14px)
padding: spacing.2xl (16px)
border: 1px solid colors.border
```

### Hero Card (gold)

```
background: linear-gradient(135deg, colors.gold 0%, colors.goldBright 100%)
borderRadius: radius.5xl (20px)
padding: spacing.3xl (20px)
color: colors.dark
```

Used for: points card on Home, featured rewards, success states.

### Stat Tile

```
background: colors.darker
border: 1px solid colors.border
borderRadius: radius.2xl (14px)
padding: spacing.lg (12px)
height: ~60px

Top row: small icon (12px) + label (9pt, gold or muted, uppercase, letter-spaced)
Bottom row: value (22pt, Oswald, white) + optional unit (11pt, muted)
```

### Points Badge

```
display: inline-flex
background: colors.gold
color: colors.dark
padding: 3px 8px
borderRadius: radius.full
fontSize: 11pt
fontWeight: 800

Content: <Sparkles icon /> +25
```

### Primary Button

```
background: colors.gold
color: colors.dark
borderRadius: radius.2xl (14px)
padding: 18px (vertical) 20px (horizontal)
fontSize: 14pt
fontWeight: 800
fontFamily: Oswald
letterSpacing: 1
textTransform: uppercase
```

### Secondary Button

```
background: colors.darker
color: colors.gold
border: 1px solid colors.gold
borderRadius: radius.xl (12px)
padding: 14px (vertical) 16px (horizontal)
fontSize: 12pt
fontWeight: 800
fontFamily: Oswald
letterSpacing: 1
textTransform: uppercase
```

### Bottom Nav Tab

```
container: 5 tabs, equal width
each tab:
  icon: 20px, gold if active, muted if inactive
  label: 10pt, Oswald, uppercase, gold if active, muted if inactive
  active state: stroke-width 2.5
  inactive state: stroke-width 2
container background: rgba(28, 27, 26, 0.95) with backdrop-blur
border-top: 1px solid colors.border
padding: 10px 8px 24px (extra bottom for safe area)
```

---

## 7. Screen Layouts

Every screen in the athlete app follows this layout:

```
┌─────────────────────────────┐
│      Status bar (47pt)      │  ← system area
├─────────────────────────────┤
│                             │
│   Screen content (scroll)   │  ← main area
│                             │
│   Padding: 20px horizontal  │
│   Safe area top respected   │
│                             │
├─────────────────────────────┤
│      Bottom nav (78pt)      │  ← persistent bottom
└─────────────────────────────┘
```

### Header pattern (top of each screen)

For tab screens (Home, Work, Book, Earn, Me):
```
Padding-top: 20px
Padding-horizontal: 20px

Pre-title: small label (10pt, gold, uppercase, letter-spaced)
  Example: "WELCOME BACK" / "RESERVE YOUR SPOT" / "FROM COACH"

Title: large display text (32pt, Oswald, -0.8 letter-spacing)
  Example: "JAKE RODRIGUEZ" / "BOOK" / "WORK"
```

For detail screens (drilling down):
```
Top row:
  Left: ChevronLeft (24px, white)
  Right: action icons (20px, gold)
```

---

## 8. Animation & Interaction

- **Tap feedback:** Use `<TouchableOpacity activeOpacity={0.7}>` or `<Pressable>` with style change
- **Haptics:** Light impact on primary actions (booking, redeeming, sending message). Use `expo-haptics`.
- **Transitions:** Stack navigator with horizontal slide for screen changes
- **Loading states:** Use skeleton loaders matching the final card shape, NEVER spinners
- **Pull-to-refresh:** Available on Home, Work, Book, Earn (refreshes data)

---

## 9. Asset Inventory

Required assets (need to be created or sourced):

- [ ] App icon (1024x1024) — Infinite Hitting "IH" gold-on-dark
- [ ] Splash screen — full-screen IH brand mark
- [ ] Tab bar icons (we use `lucide-react-native` for now, may swap to custom)
- [ ] Achievement badges (12 SVGs, gold-on-dark)
- [ ] Reward placeholder images for store

---

## 10. Implementation Notes

### Using design tokens

Every styled component imports from tokens:

```typescript
import { colors, spacing, radius, fonts, fontSizes, fontWeights } from '@/theme/tokens';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.textOnDark,
    letterSpacing: -0.5,
  },
});
```

**NEVER hardcode colors, fonts, or spacing values** in component files. Always reference tokens.

### Matching the prototype

When implementing a screen:

1. Open `/design/InfiniteHittingApp.jsx`
2. Find the corresponding component (e.g., `HomeScreen`)
3. Read the JSX structure carefully
4. Note the exact spacing, colors, font sizes used (these will reference inline values like `'#F1E5AD'` — translate them to tokens)
5. Replicate the component hierarchy in React Native
6. Use design tokens (NOT inline values) in the production code
7. Render on Expo Go and visually compare to the prototype

### React Native vs Web differences

The prototype is web React. Key translations for React Native:

| Web (prototype) | React Native (production) |
|---|---|
| `<div>` | `<View>` |
| `<span>`, `<p>` | `<Text>` |
| `onClick` | `onPress` |
| `<img>` | `<Image>` |
| `style={{ ... }}` (inline) | `StyleSheet.create({...})` |
| `cursor: 'pointer'` | omit (RN Pressable handles it) |
| `position: 'sticky'` | not supported, use ScrollView with sticky header |
| CSS gradients | `expo-linear-gradient` |
| `backdrop-filter: blur` | `BlurView` from `expo-blur` |
| SVG inline | `react-native-svg` components |
| Lucide icons | `lucide-react-native` package |
