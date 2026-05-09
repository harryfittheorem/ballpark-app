/**
 * The actual 1080x1920 artwork. Rendered with absolute pixel sizes — when
 * scaled into the on-screen preview via a Transform, every value is divided
 * proportionally so the preview is pixel-true. NEVER read from `Dimensions`
 * here, the card must be the same in both the preview AND the off-screen
 * capture render so what the parent sees is what they share.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Star } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { Swing } from '@/api/swings';
import { colors, fontFamilies } from '@/theme';

const METRIC_LABEL: Record<string, string> = {
  exit_velocity_mph: 'EXIT VELO',
  launch_angle_deg: 'LAUNCH',
  distance_ft: 'DISTANCE',
  pitch_speed_mph: 'PITCH',
};
const METRIC_UNIT: Record<string, string> = {
  exit_velocity_mph: 'MPH',
  launch_angle_deg: '°',
  distance_ft: 'FT',
  pitch_speed_mph: 'MPH',
};

function fmt(v: number | null | undefined, digits = 1): string {
  if (v == null) return '—';
  return Number(v).toFixed(digits);
}

export default function ShareCardArtwork({
  kidName,
  swing,
  prMetrics,
  ageGroup,
  facilityName,
  facilityLocation,
  achievedAt,
}: {
  kidName: string;
  swing: Swing;
  prMetrics: string[];
  ageGroup: string | null;
  facilityName: string;
  facilityLocation: string | null;
  achievedAt: Date;
}) {
  const metrics: { key: keyof Swing & string }[] = [
    { key: 'exit_velocity_mph' },
    { key: 'launch_angle_deg' },
    { key: 'distance_ft' },
    { key: 'pitch_speed_mph' },
  ];
  const isPr = prMetrics.length > 0;

  return (
    <View
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: colors.darkest,
      }}
    >
      <LinearGradient
        colors={[colors.darkest, colors.dark, colors.darker]}
        style={{ position: 'absolute', inset: 0 }}
      />
      {/* Top brand strip */}
      <View
        style={{
          paddingHorizontal: 80,
          paddingTop: 100,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontFamily: fontFamilies.oswaldBold,
            color: colors.gold,
            fontSize: 56,
            letterSpacing: 6,
          }}
        >
          BALLPARK
        </Text>
        {isPr ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              backgroundColor: colors.gold,
              paddingHorizontal: 36,
              paddingVertical: 18,
              borderRadius: 999,
            }}
          >
            <Star size={36} color={colors.dark} fill={colors.dark} />
            <Text
              style={{
                fontFamily: fontFamilies.oswaldBold,
                color: colors.dark,
                fontSize: 44,
                letterSpacing: 4,
              }}
            >
              NEW PR
            </Text>
          </View>
        ) : null}
      </View>

      {/* Big athlete name + age group + headline */}
      <View style={{ paddingHorizontal: 80, marginTop: 200 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Text
            style={{
              fontFamily: fontFamilies.interSemiBold,
              color: colors.textLight,
              fontSize: 38,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            {kidName}
          </Text>
          {ageGroup ? (
            <Text
              style={{
                fontFamily: fontFamilies.interMedium,
                color: colors.gold,
                fontSize: 30,
                letterSpacing: 4,
                marginLeft: 24,
                textTransform: 'uppercase',
              }}
            >
              · {ageGroup}
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            fontFamily: fontFamilies.oswaldBold,
            color: colors.gold,
            fontSize: isPr ? 128 : 144,
            letterSpacing: 4,
            marginTop: 12,
            lineHeight: isPr ? 144 : 160,
          }}
        >
          {isPr ? 'NEW PERSONAL BEST' : 'BIG SWING'}
        </Text>
      </View>

      {/* Hero metric — pick the most-impressive metric (PR > exit velo > distance) */}
      <HeroMetric swing={swing} prMetrics={prMetrics} />

      {/* Lower 2x2 metric grid */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: 80,
          marginTop: 80,
        }}
      >
        {metrics.map(({ key }) => {
          const v = swing[key] as number | null;
          const isPrMetric = prMetrics.includes(key);
          const digits = key === 'launch_angle_deg' || key === 'distance_ft' ? 0 : 1;
          return (
            <View
              key={key}
              style={{
                width: '50%',
                paddingVertical: 32,
                borderTopWidth: 2,
                borderColor: 'rgba(241, 229, 173, 0.2)',
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.interMedium,
                  color: colors.textLight,
                  fontSize: 28,
                  letterSpacing: 3,
                }}
              >
                {METRIC_LABEL[key]}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 12 }}>
                <Text
                  style={{
                    fontFamily: fontFamilies.oswaldBold,
                    color: isPrMetric ? colors.gold : colors.textOnDark,
                    fontSize: 88,
                  }}
                >
                  {fmt(v, digits)}
                </Text>
                <Text
                  style={{
                    fontFamily: fontFamilies.oswaldMedium,
                    color: colors.textLight,
                    fontSize: 36,
                    marginLeft: 12,
                  }}
                >
                  {METRIC_UNIT[key]}
                </Text>
                {isPrMetric ? (
                  <Star
                    size={32}
                    color={colors.gold}
                    fill={colors.gold}
                    style={{ marginLeft: 16 }}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Footer: facility wordmark + location + date */}
      <View
        style={{
          position: 'absolute',
          bottom: 100,
          left: 80,
          right: 80,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text
            style={{
              fontFamily: fontFamilies.oswaldBold,
              color: colors.gold,
              fontSize: 36,
              letterSpacing: 4,
            }}
          >
            {facilityName.toUpperCase()}
          </Text>
          {facilityLocation ? (
            <Text
              style={{
                fontFamily: fontFamilies.interMedium,
                color: colors.textLight,
                fontSize: 26,
                letterSpacing: 2,
                marginTop: 8,
              }}
            >
              {facilityLocation}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              fontFamily: fontFamilies.interMedium,
              color: colors.textLight,
              fontSize: 26,
              letterSpacing: 2,
            }}
          >
            {formatDate(achievedAt)}
          </Text>
          <Text
            style={{
              fontFamily: fontFamilies.interMedium,
              color: colors.gold,
              fontSize: 26,
              letterSpacing: 2,
              marginTop: 8,
            }}
          >
            ballpark.app
          </Text>
        </View>
      </View>
    </View>
  );
}

function formatDate(d: Date): string {
  const valid = !Number.isNaN(d.getTime()) ? d : new Date();
  return valid
    .toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();
}

function HeroMetric({ swing, prMetrics }: { swing: Swing; prMetrics: string[] }) {
  // Prefer a PR metric, then exit velocity, then distance.
  const candidates: { key: keyof Swing & string; digits: number }[] = [
    { key: 'exit_velocity_mph', digits: 1 },
    { key: 'distance_ft', digits: 0 },
    { key: 'pitch_speed_mph', digits: 1 },
    { key: 'launch_angle_deg', digits: 0 },
  ];
  const prFirst = candidates.find(
    (c) => prMetrics.includes(c.key) && swing[c.key] != null,
  );
  const fallback = candidates.find((c) => swing[c.key] != null);
  const choice = prFirst ?? fallback;
  if (!choice) return null;
  const v = swing[choice.key] as number;
  return (
    <View style={{ paddingHorizontal: 80, marginTop: 60 }}>
      <Text
        style={{
          fontFamily: fontFamilies.interMedium,
          color: colors.gold,
          fontSize: 32,
          letterSpacing: 4,
        }}
      >
        {METRIC_LABEL[choice.key]}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16 }}>
        <Text
          style={{
            fontFamily: fontFamilies.oswaldBold,
            color: colors.gold,
            fontSize: 240,
            lineHeight: 240,
          }}
        >
          {fmt(v, choice.digits)}
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.oswaldMedium,
            color: colors.textOnDark,
            fontSize: 72,
            marginLeft: 24,
          }}
        >
          {METRIC_UNIT[choice.key]}
        </Text>
      </View>
    </View>
  );
}
