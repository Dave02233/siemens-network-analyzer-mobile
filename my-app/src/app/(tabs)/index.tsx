import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';

export default function HomeScreen() {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 800 });
    translateY.value = withSpring(0);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={animStyle}>
        <Text style={styles.title}>Siemens Network Analyzer</Text>
        <Text style={styles.subtitle}>Pronto per lo scan</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' },
  title: { fontSize: 22, fontWeight: '700', color: '#ffffff', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
});