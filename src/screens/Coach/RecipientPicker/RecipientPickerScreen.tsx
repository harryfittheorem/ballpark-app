/**
 * RecipientPickerScreen — v0.4 Step 4.9.
 *
 * Right after a video uploads, the coach picks which kid it's for. Single-
 * select, grouped by family for readability. The actual `coach_messages`
 * INSERT happens on the next screen (Send Confirmation, Step 4.10); this
 * screen only collects `{ recipientFamilyId, recipientKidId }` and forwards
 * them along with the `videoId`.
 *
 * Reaching the screen without a `videoId` route param is treated as a
 * navigation bug — we surface a toast and pop back to the Coach landing
 * screen instead of crashing on `route.params.videoId`.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui';
import { useTenantKids } from '@/hooks/useTenantKids';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors } from '@/theme';
import { errorMessage } from '@/utils/error';

import KidRow from './components/KidRow';
import { groupByFamily } from './groupByFamily';
import { styles } from './styles';

type Nav = CoachInboxStackScreenProps<'RecipientPicker'>['navigation'];
type Route = CoachInboxStackScreenProps<'RecipientPicker'>['route'];

export default function RecipientPickerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  // route.params is typed as required, but a programming bug elsewhere
  // could push us here without it; guard defensively.
  const videoId = (route.params as { videoId?: string } | undefined)?.videoId;
  const { showToast } = useToast();

  const { kids, loading, error, refetch, isFetching } = useTenantKids();
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);

  // Missing-param case: surface a toast and go home.
  useEffect(() => {
    if (!videoId) {
      showToast('Something went wrong — please try again');
      navigation.popToTop();
    }
  }, [videoId, navigation, showToast]);

  const sections = useMemo(
    () =>
      groupByFamily(kids).map((s) => ({
        title: `${s.familyLastName} Family`,
        familyId: s.familyId,
        data: s.kids,
      })),
    [kids],
  );

  const selectedFamilyId = useMemo(() => {
    if (!selectedKidId) return null;
    const found = kids.find((k) => k.kidId === selectedKidId);
    return found?.familyId ?? null;
  }, [selectedKidId, kids]);

  // Once the videoId-missing branch fires we pop, but the render still
  // happens once. Bail early so we don't try to read `videoId!` below.
  if (!videoId) {
    return <SafeAreaView style={styles.safe} edges={['bottom']} />;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn&apos;t load families</Text>
          <Text style={styles.emptyBody}>{errorMessage(error)}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.retryBtn}
            onPress={() => void refetch()}
            disabled={isFetching}
          >
            <Text style={styles.retryBtnText}>
              {isFetching ? 'Retrying…' : 'Retry'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (kids.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No families yet</Text>
          <Text style={styles.emptyBody}>
            No families have signed up yet — ask the front desk to add some.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const canContinue = !!selectedKidId && !!selectedFamilyId;

  const handleContinue = () => {
    if (!canContinue || !selectedKidId || !selectedFamilyId) return;
    navigation.navigate('SendConfirmation', {
      videoId,
      recipientFamilyId: selectedFamilyId,
      recipientKidId: selectedKidId,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.flex}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.kidId}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <KidRow
              kid={item}
              selected={item.kidId === selectedKidId}
              onSelect={setSelectedKidId}
            />
          )}
        />

        {canContinue ? (
          <SafeAreaView edges={['bottom']} style={styles.footer}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Continue to send confirmation"
              style={styles.continueBtn}
              onPress={handleContinue}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
            </TouchableOpacity>
          </SafeAreaView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
