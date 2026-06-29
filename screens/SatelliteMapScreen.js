import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Platform, Pressable,
  SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { SVGWorldMap } from '../src/components/SVGWorldMap';
import { SatCard } from '../src/components/SatCard';
import { StyledSwitchRow } from '../src/components/StyledSwitchRow';
import { SAT_API_URL } from '../api';

export default function SatelliteMapScreen({ onLogout }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  const [switches, setSwitches] = useState({
    adjacent: false,
    distances: false,
    covBox: false,
    covStrips: false,
    maxService: true,
    progPitch: false,
    entryTime: false,
  });

  const toggleSwitch = useCallback((key) => {
    if (key === 'entryTime') {
      setSwitches(prev => ({ ...prev, [key]: !prev[key] }));
      openPredictionsModal();
      return;
    }
    setSwitches(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const openPredictionsModal = async () => {
    setIsPredictionModalOpen(true);
    setLoadingPredictions(true);
    try {
      const res = await fetch(`${SAT_API_URL}/api/oneweb-predictions`);
      const json = await res.json();
      if (json.success && json.predictions) setPredictions(json.predictions);
    } catch (err) {
      console.log('Prediction fetch error:', err);
    } finally {
      setLoadingPredictions(false);
    }
  };

  const fetchSatellites = useCallback(() => {
    fetch(`${SAT_API_URL}/api/satellites?oneweb_planes=true`)
      .then(res => res.json())
      .then(json => {
        setData(Array.isArray(json.satellites) ? json.satellites : []);
        setLoading(false);
        setTimestamp(new Date().toLocaleTimeString('th-TH'));
      })
      .catch(err => {
        console.log('Fetch error:', err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchSatellites();
    const interval = setInterval(fetchSatellites, 5000);
    return () => clearInterval(interval);
  }, [fetchSatellites]);

  const filteredData = useMemo(() => {
    let result = data;
    if (!switches.adjacent) result = result.filter(sat => !sat.isAdjacent);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(sat =>
        (sat.name || '').toLowerCase().includes(q) ||
        (sat.noradId || '').toString().includes(q)
      );
    }
    return result;
  }, [data, searchQuery, switches.adjacent]);

  const distanceLines = useMemo(() => {
    if (!switches.distances) return [];
    const a = 6378.137, b = 6356.752;
    const onewebs = filteredData
      .filter(s => s.name && s.name.toUpperCase().includes('ONEWEB'))
      .map(sat => {
        const latR = sat.lat * Math.PI / 180;
        const lonR = sat.lon * Math.PI / 180;
        const Re = Math.sqrt(
          (Math.pow(a * a * Math.cos(latR), 2) + Math.pow(b * b * Math.sin(latR), 2)) /
          (Math.pow(a * Math.cos(latR), 2) + Math.pow(b * Math.sin(latR), 2))
        );
        const R = Re + (sat.alt || 1200);
        return { ...sat, x: R * Math.cos(latR) * Math.cos(lonR), y: R * Math.cos(latR) * Math.sin(lonR), z: R * Math.sin(latR) };
      });

    const drawn = new Set();
    const lines = [];
    onewebs.forEach(sA => {
      let nN = null, dN = Infinity, nS = null, dS = Infinity, nE = null, dE = Infinity, nW = null, dW = Infinity;
      onewebs.forEach(sB => {
        if (sA.noradId === sB.noradId) return;
        const dLat = sB.lat - sA.lat;
        let dLon = sB.lon - sA.lon;
        if (dLon > 180) dLon -= 360;
        if (dLon < -180) dLon += 360;
        if (Math.abs(dLat) > 30 || Math.abs(dLon) > 30) return;
        const dist = Math.sqrt(Math.pow(sB.x - sA.x, 2) + Math.pow(sB.y - sA.y, 2) + Math.pow(sB.z - sA.z, 2));
        if (dist > 2500) return;
        if (Math.abs(dLat) > Math.abs(dLon)) {
          if (dLat > 0 && dist < dN) { nN = { sat: sB, dist }; dN = dist; }
          else if (dLat < 0 && dist < dS) { nS = { sat: sB, dist }; dS = dist; }
        } else {
          if (dLon > 0 && dist < dE) { nE = { sat: sB, dist }; dE = dist; }
          else if (dLon < 0 && dist < dW) { nW = { sat: sB, dist }; dW = dist; }
        }
      });
      [nN, nS, nE, nW].filter(Boolean).forEach(n => {
        const id1 = Math.min(parseInt(sA.noradId), parseInt(n.sat.noradId));
        const id2 = Math.max(parseInt(sA.noradId), parseInt(n.sat.noradId));
        const key = `${id1}-${id2}`;
        if (!drawn.has(key)) {
          drawn.add(key);
          lines.push({ lat1: sA.lat, lon1: sA.lon, lat2: n.sat.lat, lon2: n.sat.lon, dist: n.dist });
        }
      });
    });
    return lines;
  }, [filteredData, switches.distances]);

  const onewebCount = useMemo(
    () => filteredData.filter(s => s.name && s.name.toUpperCase().includes('ONEWEB')).length,
    [filteredData]
  );

  const renderHeader = () => (
    <View style={{ paddingTop: 10 }}>
      <View style={styles.headerRow}>
        <Feather name="globe" size={24} color="#334155" style={{ marginRight: 10 }} />
        <View>
          <Text style={styles.mainTitle}>SATELLITES OVER TH</Text>
          <Text style={styles.subTitle}>REAL-TIME MAP SIMULATION</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.statsRow}>
        <View>
          <Text style={styles.statsBigNumber}>{filteredData.length}</Text>
          <Text style={styles.statsLabel}>ACTIVE OBJECTS</Text>
        </View>
        <View>
          <Text style={[styles.statsBigNumber, { color: '#3b82f6', fontSize: 32 }]}>{onewebCount}</Text>
          <Text style={styles.statsLabel}>ONEWEB</Text>
        </View>
        <View style={styles.statsRight}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.timestampText}>{timestamp || 'WAITING...'}</Text>
        </View>
      </View>
      <View style={styles.filterRow}>
        <View style={styles.dropdownBox}>
          <Text style={styles.dropdownText}>ALL TYPES</Text>
          <Feather name="chevron-down" size={16} color="#64748b" />
        </View>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search ID/Name"
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      <View style={styles.switchesContainer}>
        <StyledSwitchRow title="SHOW ADJACENT ONEWEB PLANES" color="#94a3b8" active={switches.adjacent} onToggle={() => toggleSwitch('adjacent')} />
        <StyledSwitchRow title="SHOW ONEWEB DISTANCES" icon="map-pin" color="#60a5fa" active={switches.distances} onToggle={() => toggleSwitch('distances')} />
        <StyledSwitchRow title="MAX SERVICE AREA (684KM)" icon="target" color="#eab308" active={switches.maxService} onToggle={() => toggleSwitch('maxService')} />
        <StyledSwitchRow title="PROGRESSIVE PITCH & GSO PROTECTION" icon="dollar-sign" color="#f87171" active={switches.progPitch} onToggle={() => toggleSwitch('progPitch')} />
        <StyledSwitchRow title="ONEWEB ENTRY TIME" icon="clock" color="#34d399" active={switches.entryTime} onToggle={() => toggleSwitch('entryTime')} extraBtn="CHECK TIME" />
      </View>
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Feather name="log-out" size={14} color="#f87171" />
        <Text style={styles.logoutText}>ออกจากระบบ</Text>
      </TouchableOpacity>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>SATELLITE DATA</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* SVG Map */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mapContainer}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SVGWorldMap satellites={filteredData} switches={switches} distanceLines={distanceLines} />
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#0ea5e9" />
              <Text style={styles.loadingText}>กำลังโหลดข้อมูลดาวเทียม...</Text>
            </View>
          )}
        </ScrollView>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} /><Text style={styles.legendText}>OneWeb</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} /><Text style={styles.legendText}>OneWeb / TH</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#475569' }]} /><Text style={styles.legendText}>Other</Text></View>
      </View>

      {/* Hamburger */}
      <TouchableOpacity style={styles.menuButton} onPress={() => setIsMenuOpen(true)}>
        <Feather name="menu" size={28} color="#334155" />
      </TouchableOpacity>

      {/* Control Panel Modal */}
      <Modal visible={isMenuOpen} animationType="slide" transparent onRequestClose={() => setIsMenuOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>CONTROL PANEL</Text>
              <TouchableOpacity onPress={() => setIsMenuOpen(false)} style={styles.closeBtn}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredData}
              keyExtractor={(item, i) => item.noradId?.toString() ?? i.toString()}
              ListHeaderComponent={renderHeader()}
              contentContainerStyle={styles.panelContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <SatCard sat={item} />}
              initialNumToRender={5}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews
            />
          </View>
        </View>
      </Modal>

      {/* Predictions Modal */}
      <Modal visible={isPredictionModalOpen} animationType="fade" transparent onRequestClose={() => setIsPredictionModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ONEWEB PASS PREDICTIONS</Text>
              <TouchableOpacity onPress={() => setIsPredictionModalOpen(false)} style={styles.closeBtn}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.panelContent}>
              {loadingPredictions ? (
                <ActivityIndicator size="large" color="#10b981" />
              ) : predictions.length === 0 ? (
                <Text style={styles.listTitle}>No OneWeb satellites predicted in next 90 mins.</Text>
              ) : (
                <FlatList
                  data={predictions}
                  keyExtractor={item => item.noradId.toString()}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.predictionRow}>
                      <Text style={styles.predName}>{item.name}</Text>
                      <View style={styles.predInBadge}><Text style={styles.predInText}>{item.entry_in} MINS</Text></View>
                      <Text style={styles.predDuration}>{item.duration} mins</Text>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f172a' },
  mapContainer: { flex: 1 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  loadingText: { marginTop: 12, color: '#94a3b8', fontSize: 13 },
  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    paddingVertical: 6, backgroundColor: 'rgba(15,23,42,0.9)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#94a3b8', fontSize: 10, fontFamily: MONO },
  menuButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) + 16 : 56,
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 10, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    height: '85%', backgroundColor: '#ffffff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 14, fontWeight: 'bold', color: '#334155', letterSpacing: 1.5 },
  closeBtn: { backgroundColor: '#f1f5f9', padding: 6, borderRadius: 20 },
  panelContent: { padding: 24, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  mainTitle: { fontSize: 22, fontWeight: '300', color: '#334155', letterSpacing: 1 },
  subTitle: { fontSize: 10, color: '#64748b', letterSpacing: 1.5, marginTop: 4, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 },
  statsBigNumber: { fontSize: 48, fontWeight: '300', color: '#334155', lineHeight: 52 },
  statsLabel: { fontSize: 10, color: '#64748b', letterSpacing: 1.5, fontWeight: '600', marginTop: 4 },
  statsRight: { alignItems: 'flex-end' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86efac', marginRight: 4 },
  liveText: { fontSize: 10, color: '#64748b', letterSpacing: 1, fontWeight: '600' },
  timestampText: { fontSize: 10, color: '#94a3b8', fontFamily: MONO },
  filterRow: { flexDirection: 'row', marginBottom: 24, gap: 12 },
  dropdownBox: {
    flex: 0.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4,
    paddingHorizontal: 12, height: 40, backgroundColor: '#fafafa',
  },
  dropdownText: { fontSize: 11, color: '#334155', fontWeight: '500' },
  searchBox: {
    flex: 0.6, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4,
    paddingHorizontal: 12, height: 40, justifyContent: 'center', backgroundColor: '#fafafa',
  },
  searchInput: { fontSize: 12, color: '#334155' },
  switchesContainer: { marginBottom: 16 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 6, marginBottom: 16, alignSelf: 'flex-start',
  },
  logoutText: { fontSize: 12, color: '#f87171', fontWeight: '600' },
  listHeader: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
  listTitle: { fontSize: 12, fontWeight: '600', color: '#94a3b8', letterSpacing: 1 },
  predictionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  predName: { fontSize: 12, fontWeight: 'bold', color: '#334155', flex: 1 },
  predInBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  predInText: { fontSize: 10, fontWeight: 'bold', color: '#d97706' },
  predDuration: { fontSize: 10, color: '#64748b', fontWeight: '600' },
});
