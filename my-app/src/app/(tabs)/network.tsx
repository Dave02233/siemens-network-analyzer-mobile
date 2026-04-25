import * as Network from '@/utils/NetworkUtils';
import * as TcpNetwork from '@/utils/tcpNetworkUtils';
import * as UdpNetwork from '@/utils/udpNetworkUtils';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';

// ─── Tipi ────────────────────────────────────────────────────────────────────

type Protocol = 'TCP' | 'UDP' | 'TCP+UDP';

type DeviceInfo = {
  ip: string;
  protocol: Protocol;
  sysName?: string;
  sysDescr?: string;
};

// ─── SNMP Enrichment ─────────────────────────────────────────────────────────

const SNMP_OIDS = {
  sysName:  '1.3.6.1.2.1.1.5.0',
  sysDescr: '1.3.6.1.2.1.1.1.0',
};

async function enrichWithSnmp(ip: string): Promise<Pick<DeviceInfo, 'sysName' | 'sysDescr'>> {
  try {
    const results = await UdpNetwork.snmpGet(ip, [SNMP_OIDS.sysName, SNMP_OIDS.sysDescr]);
    const find = (oid: string) => results.find((r: any) => r.oid === oid)?.value;
    return {
      sysName:  find(SNMP_OIDS.sysName),
      sysDescr: find(SNMP_OIDS.sysDescr),
    };
  } catch {
    return {};
  }
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function NetworkScreen() {
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState(false);
  const [searchAddresses, setSearchAddresses] = useState<Network.ipRange>({
    initial: '192.168.0.1',
    final:   '192.168.0.254',
  });
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [elapsedTime, setElapsedTime] = useState<Network.ElapsedTime>({
    initialMs: Date.now(),
    actualMs:  Date.now(),
  });
  const scale = useSharedValue(1);

  const pulse = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleScan = async (mode: 'normal' | 'intensive') => {
    if (scanning) return;

    setScanning(true);
    setEnriching(false);
    setError(false);
    setDevices([]);
    setElapsedTime({ initialMs: Date.now(), actualMs: Date.now() });

    const interval = setInterval(() => {
      setElapsedTime(prev => ({ ...prev, actualMs: Date.now() }));
    }, 1000);

    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1.05, { duration: 100 }),
      withTiming(1,    { duration: 100 })
    );

    const ips = Network.getIpRange(searchAddresses);

    const timeout = setTimeout(() => {
      setError(true);
      setScanning(false);
    }, ips.length * 40000);

    try {
      // 1. Scan TCP + UDP in parallelo
      const [tcpResults, udpResults] = await Promise.all([
        TcpNetwork.pingSubnet(ips, mode),
        UdpNetwork.udpScanSubnet(ips),
      ]);

      const tcpSet = new Set(tcpResults.filter(r => r.ok).map(r => r.ip));
      const udpSet = new Set(udpResults.filter(r => r.ok).map(r => r.ip));
      const allIps = [...new Set([...tcpSet, ...udpSet])];

      console.log('TCP:', [...tcpSet]);
      console.log('UDP only:', [...udpSet].filter(ip => !tcpSet.has(ip)));

      clearTimeout(timeout);
      clearInterval(interval);
      setScanning(false);

      if (allIps.length === 0) return;

      // 2. Enrichment SNMP in parallelo su tutti gli IP trovati
      setEnriching(true);

      const enriched = await Promise.all(
        allIps.map(async (ip): Promise<DeviceInfo> => {
          const protocol: Protocol =
            tcpSet.has(ip) && udpSet.has(ip) ? 'TCP+UDP' :
            tcpSet.has(ip) ? 'TCP' : 'UDP';

          const snmp = await enrichWithSnmp(ip);
          return { ip, protocol, ...snmp };
        })
      );

      setDevices(enriched);
      setEnriching(false);

    } catch (e) {
      clearTimeout(timeout);
      clearInterval(interval);
      setError(true);
      setScanning(false);
      setEnriching(false);
      alert(String(e));
    }
  };

  const elapsed = Math.round((elapsedTime.actualMs - elapsedTime.initialMs) / 1000);

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
            onChangeText={text => setSearchAddresses(prev => ({ ...prev, initial: text }))}
          />
          <TextInput
            style={styles.input}
            placeholder="IP finale"
            placeholderTextColor="#555"
            value={searchAddresses.final}
            onChangeText={text => setSearchAddresses(prev => ({ ...prev, final: text }))}
          />
        </View>

        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonLeft, scanning && styles.buttonDisabled]}
            onPress={() => handleScan('normal')}
            disabled={scanning}
          >
            <Text style={styles.buttonText}>Scan normale</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonRight, scanning && styles.buttonDisabled]}
            onPress={() => handleScan('intensive')}
            disabled={scanning}
          >
            <Text style={styles.buttonText}>Scan intensivo</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {scanning  && <Text style={styles.hint}>{`Ricerca dispositivi in corso... (${elapsed}s)`}</Text>}
      {enriching && <Text style={styles.hint}>Raccolta info SNMP...</Text>}
      {error     && <Text style={styles.error}>Errore durante lo scan. Riprova.</Text>}

      {!scanning && !error && devices.length > 0 && (
        <ScrollView style={{ marginTop: 20, width: '90%' }}>
          <Text style={styles.sectionLabel}>
            Dispositivi trovati ({devices.length}):
          </Text>
          {devices.map(device => (
            <View key={device.ip} style={styles.deviceCard}>
              {/* Header: IP + badge protocollo */}
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceIp}>{device.ip}</Text>
                <View style={[
                  styles.badge,
                  device.protocol === 'TCP+UDP' ? styles.badgeBoth  :
                  device.protocol === 'UDP'     ? styles.badgeUdp   :
                                                  styles.badgeTcp,
                ]}>
                  <Text style={styles.badgeText}>{device.protocol}</Text>
                </View>
              </View>

              {/* SNMP info se disponibili */}
              {device.sysName && (
                <Text style={styles.deviceName}>{device.sysName}</Text>
              )}
              {device.sysDescr && (
                <Text style={styles.deviceDescr} numberOfLines={2}>
                  {device.sysDescr}
                </Text>
              )}
              {!device.sysName && !device.sysDescr && (
                <Text style={styles.deviceNoSnmp}>SNMP non disponibile</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {!scanning && !enriching && !error && devices.length === 0 && (
        <Text style={styles.hint}>
          Nessun dispositivo trovato nel range selezionato.
        </Text>
      )}
    </View>
  );
}

// ─── Stili ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' },
  title:         { fontSize: 22, fontWeight: '700', color: '#ffffff', marginBottom: 32 },
  card:          { width: '90%', padding: 16, borderRadius: 16, backgroundColor: '#111', alignItems: 'center' },
  inputsRow:     { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  input:         { flex: 1, backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 4, borderWidth: 1, borderColor: '#333', fontSize: 14 },
  buttonsRow:    { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  button:        { flex: 1, backgroundColor: '#208AEF', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center' },
  buttonLeft:    { marginRight: 6 },
  buttonRight:   { marginLeft: 6 },
  buttonDisabled:{ opacity: 0.5 },
  buttonText:    { color: '#fff', fontWeight: '600', fontSize: 16 },
  hint:          { marginTop: 20, color: '#888', fontSize: 13 },
  error:         { marginTop: 20, color: '#ff3737', fontSize: 13 },
  sectionLabel:  { color: '#fff', marginBottom: 10, fontWeight: '600' },

  // Device card
  deviceCard:    { backgroundColor: '#111', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  deviceHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  deviceIp:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  deviceName:    { color: '#ccc', fontSize: 13, marginBottom: 2 },
  deviceDescr:   { color: '#666', fontSize: 11, lineHeight: 16 },
  deviceNoSnmp:  { color: '#444', fontSize: 11, fontStyle: 'italic' },

  // Badge protocollo
  badge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTcp:      { backgroundColor: '#1a3a5c' },
  badgeUdp:      { backgroundColor: '#1a4a2a' },
  badgeBoth:     { backgroundColor: '#3a2a5c' },
  badgeText:     { color: '#fff', fontSize: 10, fontWeight: '700' },
});