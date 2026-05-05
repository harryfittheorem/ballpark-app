# Design Prototypes

These are visual reference files. They are NOT production code, but they are the **authoritative source of truth** for what every screen should look like.

When implementing a screen, find the corresponding component here and match it pixel-for-pixel using React Native + design tokens.

---

## Files

### `InfiniteHittingApp.jsx` — Athlete Mobile App
**Status:** PRIMARY REFERENCE for v0.1 - v0.5
**Screens:** 32

Components defined inside (use Cmd+F to find):

- `HomeScreen` — Home tab
- `WorkScreen` — Work tab (5 sub-tabs: swings, assignments, messages, homework, drills)
- `BookScreen` — Book tab
- `BookConfirmScreen` — Booking confirmation flow
- `EarnScreen` — Earn tab (4 sub-tabs: rewards, store, ranks, earn)
- `MeScreen` — Me tab (3 sub-tabs: profile, billing, orders)
- `SwingDetailScreen` — Detail of a single swing
- `SessionDetailScreen` — Detail of a session
- `ShareCardScreen` — Social share card
- `MessageThreadInline` / `MessageThreadScreen` — Coach messaging
- `AssignmentDetailScreen` — Homework detail
- `RecordAssignmentScreen` — Record video for homework
- `RewardRedeemScreen` — Reward redemption flow
- `StoreItemScreen` — Store item with dual purchase
- `HomeworkVideoDetailScreen` — Submitted homework with coach feedback
- `BottomNav` — Bottom tab navigation (5 tabs)
- `PhoneFrame` — Wrapper showing iPhone bezel (web-only, ignore in RN)
- `SectionLabel`, `Card`, `HeroCard`, `StatTile`, `PointsBadge`, `Chip`, `SwingThumbnail`, `ProductVisual` — reusable components

### `IHPortal.jsx` — Operations Portal
**Status:** Reference for later phases (v1.0+)
**Screens:** 15
**Note:** Web app, not mobile. NOT in scope for v0.1-v0.5.

### `AILayerMockup.jsx` — AI Layer Pitch Mockup
**Status:** Reference only — NOT being built in v0.1-v0.5
**Note:** Standalone pitch site showing SMS scenarios. Will inform later product development.

---

## How to Use These Files

### Pattern: Implementing a screen

1. Open the JSX file
2. Find the corresponding component
3. Read the JSX structure carefully
4. Note styles (these will reference inline values like `'#F1E5AD'`)
5. Translate inline values to design tokens (`colors.gold`)
6. Replicate the structure in React Native using:
   - `<View>` instead of `<div>`
   - `<Text>` instead of `<span>` or `<p>`
   - `onPress` instead of `onClick`
   - `<Image>` instead of `<img>`
   - `StyleSheet.create()` instead of inline styles

### Pattern: Visual verification

After implementing, run on Expo Go and visually compare to the prototype. They should be indistinguishable in:

- Layout / spacing
- Colors
- Fonts and font sizes
- Component hierarchy
- Interaction patterns (where applicable)

If they differ, the production code is wrong, not the prototype.

---

## Translating Web Patterns to React Native

| Web Pattern | React Native Equivalent |
|---|---|
| CSS gradient | `<LinearGradient>` from `expo-linear-gradient` |
| `backdrop-filter: blur` | `<BlurView>` from `expo-blur` |
| `position: 'sticky'` | Use `ScrollView` with sticky header config |
| `cursor: 'pointer'` | Omit (RN handles via Pressable) |
| Inline SVG | `react-native-svg` |
| `<style jsx>` | Not needed (use StyleSheet) |
| `display: 'grid'` | Use `flexbox` with wrapping |
| Lucide icons (web) | `lucide-react-native` package |
| `@expo-google-fonts/*` | Same package, works on RN |

---

## Common Pitfalls

❌ **Don't copy inline `style={{ ... }}` directly.** Translate to `StyleSheet.create()` and use design tokens.

❌ **Don't try to render `PhoneFrame` in production.** That's a web-only wrapper for the prototype.

❌ **Don't use `<div>` or HTML elements** in React Native code. Always `<View>` and `<Text>`.

❌ **Don't preserve hardcoded colors.** Translate everything to `colors.X` from `/src/theme/tokens.ts`.

❌ **Don't skip the visual comparison step.** Run on Expo Go and compare side-by-side.

---

## Updating the Prototype

If a design decision changes during build:

1. Update this prototype FIRST (visual source of truth)
2. Then update the production React Native code
3. Document the change in `/docs/CHANGELOG.md`

This keeps the prototype as the canonical visual reference forever.
