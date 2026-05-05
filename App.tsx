import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>BALLPARK</Text>
      <Text style={styles.subtitle}>v0.1 — Foundation</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0E0E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: '#F1E5AD',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#9B9590',
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 1.5,
  },
});
