/**
 * Font loader for Ballpark.
 *
 * Loads Oswald (display) and Inter (body) via expo-font's useFonts hook.
 *
 * IMPORTANT — family-name-per-weight pattern:
 * `@expo-google-fonts/*` exposes each weight as a separate font asset whose
 * registered family name matches the import (e.g. `Oswald_700Bold`). React
 * Native will NOT auto-select a weight from `style.fontWeight` when these
 * fonts are loaded this way. Always pick the family explicitly via
 * `fontFamilies.oswaldBold` (etc.) from `@/theme/tokens`.
 *
 * JetBrains Mono is intentionally NOT loaded yet — it's declared in tokens
 * for design reference but won't ship until v0.5 (redemption codes / IDs).
 */

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

export function useAppFonts(): [boolean, Error | null] {
  const [loaded, error] = useFonts({
    Oswald_400Regular,
    Oswald_500Medium,
    Oswald_600SemiBold,
    Oswald_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  return [loaded, error];
}
