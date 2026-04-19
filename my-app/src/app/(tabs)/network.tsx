import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';

export default function NetworkScreen() {
  const [scanning, setScanning] = useState(false);
  const scale = useSharedValue(1);

  const pulse = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleScan = () => {
    setScanning(true);
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1.05, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
    setTimeout(() => setScanning(false), 2000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Scan</Text>
      <Animated.View style={pulse}>
        <TouchableOpacity style={[styles.button, scanning && styles.buttonActive]} onPress={handleScan}>
          <Text style={styles.buttonText}>{scanning ? 'Scanning...' : 'Avvia Scan'}</Text>
        </TouchableOpacity>
      </Animated.View>
      {scanning && <Text style={styles.hint}>Ricerca dispositivi in corso...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' },
  title: { fontSize: 22, fontWeight: '700', color: '#ffffff', marginBottom: 32 },
  button: { backgroundColor: '#208AEF', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 12 },
  buttonActive: { backgroundColor: '#1060b0' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  hint: { marginTop: 20, color: '#888', fontSize: 13 },
});