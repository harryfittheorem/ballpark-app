/**
 * VideoPreview — local playback of a freshly picked/recorded clip so the
 * coach can confirm the right video before any bytes leave the phone.
 *
 * Renders the file URI in an expo-av <Video> with native controls (matches
 * the parent VideoPlaybackScreen choice, no custom chrome to maintain), and
 * exposes "Use this video" / "Pick another" actions. Discarding here costs
 * nothing — no Mux upload has been created yet and no idempotency key has
 * been minted, so picking again is a clean restart.
 */

import { ResizeMode, Video } from 'expo-av';
import { Text, TouchableOpacity, View } from 'react-native';

import type { PickedAsset } from '../types';
import { styles } from '../styles';

type Props = {
  asset: PickedAsset;
  onConfirm: () => void;
  onPickAnother: () => void;
};

export default function VideoPreview({ asset, onConfirm, onPickAnother }: Props) {
  return (
    <View style={styles.previewBox}>
      <Text style={styles.previewTitle}>Review your video</Text>
      <Text style={styles.previewHint}>
        Make sure this is the clip you want to send.
      </Text>
      <View style={styles.previewPlayerWrap}>
        <Video
          style={styles.previewPlayer}
          source={{ uri: asset.uri }}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          isLooping={false}
        />
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Use this video"
        style={styles.primaryBtn}
        onPress={onConfirm}
      >
        <Text style={styles.primaryBtnText}>Use this video</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Pick another video"
        style={styles.secondaryBtn}
        onPress={onPickAnother}
      >
        <Text style={styles.secondaryBtnText}>Pick another</Text>
      </TouchableOpacity>
    </View>
  );
}
