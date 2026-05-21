/**
 * useLocationContext — resolves the active booking location for the Book tab.
 *
 * Priority:
 *   1. Store's activeLocationId (user switched for this session).
 *   2. family.primary_location_id (from the families row).
 *   3. null (unauthenticated / data still loading).
 *
 * The active location is ALWAYS fetched for display (the pill renders even
 * when allow_cross_location_booking=false). When cross-location booking is
 * disabled, `allLocations` is empty (no switcher) but `activeLocation` is
 * still resolved by fetching the single location by ID.
 *
 * When allow_cross_location_booking=true, all tenant locations are fetched
 * to populate the switcher dropdown.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getLocationById, listTenantLocations, type Location } from '@/api/bookings';
import { getTenantConfig, type TenantConfig } from '@/api/tenantConfig';
import { useFamily } from '@/hooks/useFamily';
import { useBookingLocationStore } from '@/store/bookingLocation';

export type LocationContext = {
  activeLocationId: string | null;
  activeLocation: Location | null;
  allowCrossLocation: boolean;
  allLocations: Location[];
  setActiveLocationId: (id: string) => void;
  loading: boolean;
};

export function useLocationContext(): LocationContext {
  const { family } = useFamily();
  const primaryLocationId = family?.primary_location_id ?? null;

  const { activeLocationId, setActiveLocationId } = useBookingLocationStore();

  // Initialise the store from primary_location_id on first mount / after sign-in.
  useEffect(() => {
    if (primaryLocationId && activeLocationId === null) {
      setActiveLocationId(primaryLocationId);
    }
  }, [primaryLocationId, activeLocationId, setActiveLocationId]);

  const resolvedLocationId = activeLocationId ?? primaryLocationId;

  // Fetch tenant config.
  const { data: config, isLoading: configLoading } = useQuery<TenantConfig | null>({
    queryKey: ['tenant_config'],
    queryFn: getTenantConfig,
    staleTime: 5 * 60 * 1000,
  });

  const allowCrossLocation = config?.allow_cross_location_booking ?? false;

  // When cross-location booking is allowed: fetch all locations (for the switcher).
  // The active location is resolved from this list, so no separate fetch needed.
  const { data: locations, isLoading: allLocationsLoading } = useQuery<Location[]>({
    queryKey: ['tenant_locations'],
    queryFn: listTenantLocations,
    enabled: allowCrossLocation,
    staleTime: 5 * 60 * 1000,
  });

  const allLocations = locations ?? [];

  // When cross-location booking is disabled, fetch only the active location by
  // ID so the pill always renders — even though the switcher is hidden.
  const { data: singleLocation, isLoading: singleLocationLoading } =
    useQuery<Location | null>({
      queryKey: ['location', resolvedLocationId],
      queryFn: () => getLocationById(resolvedLocationId as string),
      enabled: !allowCrossLocation && !!resolvedLocationId,
      staleTime: 10 * 60 * 1000,
    });

  // Resolve activeLocation:
  // - Cross-location enabled: find in allLocations (populated for the switcher).
  // - Cross-location disabled: use the single-fetch result.
  const activeLocation: Location | null = allowCrossLocation
    ? (allLocations.find((l) => l.id === resolvedLocationId) ?? null)
    : (singleLocation ?? null);

  const loading =
    configLoading ||
    (allowCrossLocation && allLocationsLoading) ||
    (!allowCrossLocation && singleLocationLoading);

  return {
    activeLocationId: resolvedLocationId,
    activeLocation,
    allowCrossLocation,
    allLocations,
    setActiveLocationId,
    loading,
  };
}
