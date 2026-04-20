import * as Network from '@/utils/networkUtils';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';

export default function NetworkScreen() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(false);
  const [searchAddresses, setSearchAddresses] = useState<Network.ipRange>({initial: "192.168.0.1", final: "192.168.0.254"})
  const [reachableIps, setReachableIps] = useState<Network.addressList>([])
  const [elapsedTime, setElapsedTime] = useState<Network.ElapsedTime>({
    initialMs: Date.now(),
    actualMs: Date.now(),
  });
  const scale = useSharedValue(1);

  const pulse = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));


  const handleScan = async (mode: 'normal' | 'intensive') => {

    if (scanning) return;

    setScanning(true);
    setError(false);


    setElapsedTime(prev => ({initialMs: Date.now(), actualMs: Date.now()}))

    const interval = setInterval(() => {
      setElapsedTime(prev => ({...prev, actualMs: Date.now()}))
    }, 1000);

    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1.05, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );

    const ips = Network.getIpRange(searchAddresses);

    const timeout = setTimeout(() => {
      setError(true);
      setScanning(false);
    }, ips.length * 50000);

    try {
      const results = await Network.pingSubnet(ips, mode); 
      const reachable = results.filter(r => r.ok).map(r => r.ip);
      console.log('Reachable:', reachable);

      setReachableIps(reachable);

      clearTimeout(timeout);
      clearInterval(interval);
      setScanning(false);
    } catch (e) {
      clearTimeout(timeout);
      clearInterval(interval);
      setError(true);
      setScanning(false);
      alert(String(e));
    }

  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Scan</Text>
        <Animated.View style={[pulse, styles.card]}>
        <View style={styles.inputsRow}>
        <TextInput
          style={styles.input}
          placeholder="IP iniziale"
          placeholderTextColor="#555"
          value={searchAddresses.initial}
          onChangeText={(text) =>
            setSearchAddresses(prev => ({ ...prev, initial: text }))
          }
        />
        <TextInput
          style={styles.input}
          placeholder="IP finale"
          placeholderTextColor="#555"
          value={searchAddresses.final}
          onChangeText={(text) =>
            setSearchAddresses(prev => ({ ...prev, final: text }))
          }
        />
        </View>
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonLeft,
              scanning && styles.buttonDisabled,
            ]}
            onPress={() => handleScan('normal')}
            disabled={scanning}
          >
            <Text style={styles.buttonText}>Scan normale</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonRight,
              scanning && styles.buttonDisabled,
            ]}
            onPress={() => handleScan('intensive')}
            disabled={scanning}
          >
            <Text style={styles.buttonText}>Scan intensivo</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      {scanning && <Text style={styles.hint}>{`Ricerca dispositivi in corso...(${Math.round((elapsedTime.actualMs - elapsedTime.initialMs) / 1000)}s)`}</Text>}
      {error && <Text style={styles.error}>Errore durante lo scan. Riprova.</Text>}

      {!scanning && !error && reachableIps.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: '#fff', marginBottom: 8 }}>
            Dispositivi trovati ({reachableIps.length}):
          </Text>
          {reachableIps.map(ip => (
            <Text key={ip} style={{ color: '#888', fontSize: 13 }}>
              {ip}
            </Text>
          ))}
        </View>
      )}

      {!scanning && !error && reachableIps.length === 0 && (
        <Text style={{ marginTop: 20, color: '#888', fontSize: 13 }}>
          Nessun dispositivo trovato nel range selezionato.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 32,
  },

  card: {
    width: '90%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#111',
    alignItems: 'center',
  },

  inputsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#333',
    fontSize: 14,
  },

  buttonsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },

  button: {
    flex: 1,
    minWidth: 0,     
    backgroundColor: '#208AEF',
    paddingVertical: 14,
    paddingHorizontal: 8, 
    borderRadius: 12,
    alignItems: 'center',
  },

  buttonLeft: {
    marginRight: 6,
  },

  buttonRight: {
    marginLeft: 6,
  },

  buttonActive: {
    backgroundColor: '#1060b0',
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },

  hint: {
    marginTop: 20,
    color: '#888',
    fontSize: 13,
  },

  error: {
    marginTop: 20,
    color: '#ff3737',
    fontSize: 13,
  },
});