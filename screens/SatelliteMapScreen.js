import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, ActivityIndicator,
  TextInput, SafeAreaView, Platform, StatusBar, TouchableOpacity,
  Switch, Modal
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Polygon, Circle, Polyline } from 'react-native-maps';

import { STRIP_COLORS } from '../src/constants/theme';
import { StyledSwitchRow } from '../src/components/StyledSwitchRow';
import { SatCard } from '../src/components/SatCard';
import { DistanceMarker } from '../src/components/DistanceMarker';
import { SatOverlays } from '../src/components/SatOverlays';
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

  const [mapRegion, setMapRegion] = useState({
    latitude: 13.736717,
    longitude: 100.523186,
    latitudeDelta: 50,
    longitudeDelta: 50,
  });

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
      if (json.success && json.predictions) {
        setPredictions(json.predictions);
      }
    } catch (err) {
      console.log("Prediction fetch error:", err);
    } finally {
      setLoadingPredictions(false);
    }
  };

  const fetchSatellites = () => {
    fetch(`${SAT_API_URL}/api/satellites?oneweb_planes=true`)
      .then(res => res.json())
      .then(json => {
        setData(Array.isArray(json.satellites) ? json.satellites : []);
        setLoading(false);
        const now = new Date();
        setTimestamp(now.toLocaleTimeString('th-TH'));
      })
      .catch(err => {
        console.log("Error fetching data:", err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSatellites();
    const interval = setInterval(fetchSatellites, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredData = useMemo(() => {
    let result = data;
    if (!switches.adjacent) {
      result = result.filter(sat => !sat.isAdjacent);
    }
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(sat =>
        (sat.name || '').toLowerCase().includes(lowerQuery) ||
        (sat.noradId || '').toString().includes(lowerQuery)
      );
    }
    return result;
  }, [data, searchQuery, switches.adjacent]);

  const distanceLines = useMemo(() => {
    if (!switches.distances) return [];
    const a = 6378.137;
    const b = 6356.752;
    const onewebs = filteredData
      .filter(sat => sat.name && sat.name.toUpperCase().includes('ONEWEB'))
      .map(sat => {
        const latR = sat.lat * Math.PI / 180;
        const lonR = sat.lon * Math.PI / 180;
        const R_earth = Math.sqrt(
          (Math.pow(a * a * Math.cos(latR), 2) + Math.pow(b * b * Math.sin(latR), 2)) /
          (Math.pow(a * Math.cos(latR), 2) + Math.pow(b * Math.sin(latR), 2))
        );
        const alt = sat.alt || 1200;
        const R = R_earth + alt;
        return {
          ...sat,
          x: R * Math.cos(latR) * Math.cos(lonR),
          y: R * Math.cos(latR) * Math.sin(lonR),
          z: R * Math.sin(latR),
        };
      });

    const drawnPairs = new Set();
    const lines = [];
    onewebs.forEach(satA => {
      let nearestN = null, distN = Infinity;
      let nearestS = null, distS = Infinity;
      let nearestE = null, distE = Infinity;
      let nearestW = null, distW = Infinity;
      onewebs.forEach(satB => {
        if (satA.noradId === satB.noradId) return;
        const dLat = satB.lat - satA.lat;
        let dLon = satB.lon - satA.lon;
        if (dLon > 180) dLon -= 360;
        if (dLon < -180) dLon += 360;
        if (Math.abs(dLat) > 30 || Math.abs(dLon) > 30) return;
        const dist = Math.sqrt(
          Math.pow(satB.x - satA.x, 2) + Math.pow(satB.y - satA.y, 2) + Math.pow(satB.z - satA.z, 2)
        );
        if (dist > 2500) return;
        if (Math.abs(dLat) > Math.abs(dLon)) {
          if (dLat > 0 && dist < distN) { nearestN = { sat: satB, dist }; distN = dist; }
          else if (dLat < 0 && dist < distS) { nearestS = { sat: satB, dist }; distS = dist; }
        } else {
          if (dLon > 0 && dist < distE) { nearestE = { sat: satB, dist }; distE = dist; }
          else if (dLon < 0 && dist < distW) { nearestW = { sat: satB, dist }; distW = dist; }
        }
      });
      [nearestN, nearestS, nearestE, nearestW].filter(Boolean).forEach(n => {
        const satB = n.sat;
        const id1 = Math.min(parseInt(satA.noradId), parseInt(satB.noradId));
        const id2 = Math.max(parseInt(satA.noradId), parseInt(satB.noradId));
        const pairId = `${id1}-${id2}`;
        if (!drawnPairs.has(pairId)) {
          drawnPairs.add(pairId);
          lines.push({ lat1: satA.lat, lon1: satA.lon, lat2: satB.lat, lon2: satB.lon, dist: n.dist });
        }
      });
    });
    return lines;
  }, [filteredData, switches.distances]);

  const visibleSats = useMemo(() => {
    return filteredData.filter(sat => {
      if (sat.lat == null || sat.lon == null) return false;
      const latBuf = (mapRegion.latitudeDelta / 2) + 15;
      const lonBuf = (mapRegion.longitudeDelta / 2) + 15;
      let lonDiff = Math.abs(sat.lon - mapRegion.longitude);
      if (lonDiff > 180) lonDiff = 360 - lonDiff;
      return Math.abs(sat.lat - mapRegion.latitude) < latBuf && lonDiff < lonBuf;
    });
  }, [filteredData, mapRegion.latitude, mapRegion.longitude, mapRegion.latitudeDelta, mapRegion.longitudeDelta]);

  const renderHeader = () => (
    <View style={{ paddingTop: 10 }}>
      <View style={styles.headerRow}>
        <Feather name="globe" size={24} color="#334155" style={{ marginRight: 10 }} />
        <View>
          <Text style={styles.mainTitle}>SATELLITES OVER TH</Text>
          <Text style={styles.subTitle}>PYTHON REAL-TIME MAP SIMULATION</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.statsRow}>
        <View>
          <Text style={styles.statsBigNumber}>{filteredData.length}</Text>
          <Text style={styles.statsLabel}>ACTIVE OBJECTS</Text>
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
        <StyledSwitchRow title="COVERAGE BOX (1600x1024)" icon="square" color="#c084fc" active={switches.covBox} onToggle={() => toggleSwitch('covBox')} />
        <StyledSwitchRow title="COVERAGE STRIPS (16 BEAMS)" icon="align-justify" color="#f472b6" active={switches.covStrips} onToggle={() => toggleSwitch('covStrips')} />
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
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={mapRegion}
          onRegionChangeComplete={setMapRegion}
          customMapStyle={[
            { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#7c93a3" }, { "lightness": "-10" }] },
            { "featureType": "administrative.country", "elementType": "geometry", "stylers": [{ "visibility": "on" }] },
            { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#a0aab4" }] },
            { "featureType": "water", "elementType": "geometry.fill", "stylers": [{ "color": "#d3d9df" }] },
          ]}
        >
          {visibleSats.map((sat, index) => (
            <SatOverlays
              key={sat.noradId || index}
              sat={sat}
              switches={switches}
              stripColor={STRIP_COLORS[index % STRIP_COLORS.length]}
            />
          ))}
          {switches.distances && distanceLines.map((line) => {
            const midLat = (line.lat1 + line.lat2) / 2;
            let lon1 = line.lon1, lon2 = line.lon2;
            if (Math.abs(lon1 - lon2) > 180) {
              if (lon1 < 0) lon1 += 360;
              if (lon2 < 0) lon2 += 360;
            }
            let midLon = (lon1 + lon2) / 2;
            if (midLon > 180) midLon -= 360;
            const latBuf = (mapRegion.latitudeDelta / 2) + 20;
            const lonBuf = (mapRegion.longitudeDelta / 2) + 20;
            let lonDiff = Math.abs(midLon - mapRegion.longitude);
            if (lonDiff > 180) lonDiff = 360 - lonDiff;
            const isVisible = Math.abs(midLat - mapRegion.latitude) < latBuf && lonDiff < lonBuf;
            const lineKey = `dist-${line.lat1.toFixed(4)}-${line.lon1.toFixed(4)}-${line.lat2.toFixed(4)}-${line.lon2.toFixed(4)}`;
            return (
              <React.Fragment key={lineKey}>
                <Polyline
                  coordinates={[
                    { latitude: line.lat1, longitude: line.lon1 },
                    { latitude: line.lat2, longitude: line.lon2 },
                  ]}
                  strokeColor="#2563eb"
                  strokeWidth={1.5}
                  lineDashPattern={[5, 5]}
                  geodesic={true}
                />
                {isVisible && <DistanceMarker line={line} />}
              </React.Fragment>
            );
          })}
        </MapView>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0ea5e9" />
            <Text style={styles.loadingText}>กำลังโหลดข้อมูลดาวเทียม...</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.menuButton} onPress={() => setIsMenuOpen(true)}>
        <Feather name="menu" size={28} color="#334155" />
      </TouchableOpacity>

      <Modal visible={isMenuOpen} animationType="slide" transparent={true} onRequestClose={() => setIsMenuOpen(false)}>
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
              keyExtractor={(item, index) => item.noradId ? item.noradId.toString() : index.toString()}
              ListHeaderComponent={renderHeader()}
              contentContainerStyle={styles.panelContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <SatCard sat={item} />}
              initialNumToRender={5}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={isPredictionModalOpen} animationType="fade" transparent={true} onRequestClose={() => setIsPredictionModalOpen(false)}>
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
                  keyExtractor={(item) => item.noradId.toString()}
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  mapContainer: { flex: 1, backgroundColor: '#e2e8f0' },
  map: { ...StyleSheet.absoluteFillObject },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 13, fontWeight: '500' },
  menuButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) + 16 : 56,
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    height: '85%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  timestampText: { fontSize: 10, color: '#94a3b8', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
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
