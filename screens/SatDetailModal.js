import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

function InfoRow({ label, value, color = '#f1f5f9' }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, { color }]}>{value ?? '—'}</Text>
    </View>
  );
}

export default function SatDetailModal({ visible, sat, detail, loading, onClose }) {
  const [minimized, setMinimized] = useState(false);

  // เปลี่ยนดาวเทียม → expand ออกมาใหม่
  useEffect(() => {
    if (sat) setMinimized(false);
  }, [sat?.noradId]);

  if (!visible || !sat) return null;

  const isOneweb = sat.name?.toUpperCase().includes('ONEWEB');
  const accentColor = isOneweb ? '#0ea5e9' : '#f472b6';

  const airspaceStatus = detail?.airspace?.status;
  const airspaceColor =
    airspaceStatus === 'inside'   ? '#22c55e' :
    airspaceStatus === 'upcoming' ? '#fbbf24' : '#64748b';

  const airspaceLabel = () => {
    if (!detail?.airspace) return '—';
    const a = detail.airspace;
    if (a.status === 'inside')   return `อยู่ในไทยแล้ว (ออกใน ${a.exit_in ?? '?'} นาที)`;
    if (a.status === 'upcoming') return `เข้าไทยใน ${a.entry_in ?? '?'} นาที`;
    return 'ไม่ผ่านไทยใน 90 นาที';
  };

  // ── MINIMIZED: View เล็กชิดล่าง (แมพเลื่อนได้) ──
  if (minimized) {
    return (
      <View style={[styles.miniStrip, { borderTopColor: accentColor }]}>
        <View style={styles.miniLeft}>
          <View style={[styles.miniDot, { backgroundColor: airspaceColor }]} />
          <View>
            <Text style={[styles.miniName, { color: accentColor }]} numberOfLines={1}>
              {sat.name}
            </Text>
            <Text style={[styles.miniStatus, { color: airspaceColor }]}>
              {airspaceLabel()}  ·  {sat.alt?.toFixed(0)} km
            </Text>
          </View>
        </View>
        <View style={styles.miniBtns}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setMinimized(false)}>
            <Feather name="chevron-up" size={18} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} onPress={onClose}>
            <Feather name="x" size={18} color="#f87171" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── EXPANDED: Modal เหมือนเดิม (ไม่ลอย) ──
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { borderTopColor: accentColor }]}>

          <View style={styles.header}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Text style={[styles.satName, { color: accentColor }]} numberOfLines={1}>
                  {sat.name}
                </Text>
                <Text style={styles.noradId}>NORAD #{sat.noradId}</Text>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setMinimized(true)}>
                  <Feather name="minus" size={18} color="#94a3b8" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} onPress={onClose}>
                  <Feather name="x" size={18} color="#f87171" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={accentColor} size="large" />
              <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

              <Text style={styles.sectionTitle}>ORBITAL DATA</Text>
              <View style={styles.card}>
                <InfoRow label="Altitude"    value={`${sat.alt?.toFixed(1)} km`}           color="#34d399" />
                <InfoRow label="Speed"       value={`${sat.velocityKms?.toFixed(2)} km/s`} color="#34d399" />
                <InfoRow label="Inclination" value={`${sat.inclination?.toFixed(2)}°`} />
                <InfoRow label="Period"      value={`${sat.period?.toFixed(1)} min`} />
                <InfoRow label="Apogee"      value={`${sat.apogee?.toFixed(1)} km`} />
                <InfoRow label="Perigee"     value={`${sat.perigee?.toFixed(1)} km`} />
              </View>

              {detail && (
                <>
                  <Text style={styles.sectionTitle}>REAL-TIME (จาก Bangkok)</Text>
                  <View style={styles.card}>
                    <InfoRow label="Elevation"
                      value={`${detail.elevation?.toFixed(1)}°`}
                      color={detail.elevation > 0 ? '#34d399' : '#f87171'} />
                    <InfoRow label="Azimuth"     value={`${detail.azimuth?.toFixed(1)}°`} />
                    <InfoRow label="Distance"    value={`${detail.distance?.toFixed(0)} km`} />
                    <InfoRow label="Sunlit"
                      value={detail.sunlit ? 'กลางวัน ☀️' : 'กลางคืน 🌙'}
                      color={detail.sunlit ? '#fbbf24' : '#94a3b8'} />
                    <InfoRow label="Revolutions" value={`${detail.revolutions?.toFixed(4)}/day`} />
                  </View>

                  <Text style={styles.sectionTitle}>AIRSPACE ไทย</Text>
                  <View style={[styles.card, styles.airspaceCard, { borderColor: airspaceColor }]}>
                    <Text style={[styles.airspaceText, { color: airspaceColor }]}>
                      {airspaceLabel()}
                    </Text>
                    {detail.airspace?.duration != null && (
                      <Text style={styles.airspaceSub}>
                        อยู่ในพื้นที่ประมาณ {detail.airspace.duration} นาที
                      </Text>
                    )}
                  </View>
                </>
              )}

              {detail?.passes?.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>PASS PREDICTION (Bangkok · El ≥ 10°)</Text>
                  {detail.passes.map((p, i) => {
                    const elColor = p.max_el >= 45 ? '#22c55e' : p.max_el >= 20 ? '#fbbf24' : '#f87171';
                    const inMin = p.in_min;
                    let timeLabel;
                    if (inMin < 0) timeLabel = 'กำลังผ่าน';
                    else if (inMin < 60) timeLabel = `ใน ${inMin} นาที`;
                    else timeLabel = `ใน ${Math.floor(inMin / 60)} ชม. ${inMin % 60} นาที`;

                    const aosTime = new Date(p.aos).toLocaleTimeString('th-TH', {
                      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok'
                    });
                    const losTime = new Date(p.los).toLocaleTimeString('th-TH', {
                      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok'
                    });

                    return (
                      <View key={i} style={[styles.passCard, i === 0 && { borderColor: elColor }]}>
                        <View style={styles.passRow}>
                          <View style={[styles.passElBadge, { backgroundColor: elColor + '22', borderColor: elColor }]}>
                            <Text style={[styles.passElText, { color: elColor }]}>{p.max_el}°</Text>
                            <Text style={[styles.passElSub, { color: elColor }]}>MAX EL</Text>
                          </View>
                          <View style={styles.passInfo}>
                            <Text style={[styles.passTime, i === 0 && { color: elColor }]}>{timeLabel}</Text>
                            <Text style={styles.passWindow}>{aosTime} → {losTime}  ({p.duration_min} นาที)</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}

              <Text style={styles.sectionTitle}>IDENTITY</Text>
              <View style={styles.card}>
                <InfoRow label="Country"     value={sat.countryCode} />
                <InfoRow label="Object Type" value={sat.objectType} />
                <InfoRow label="Launch Year" value={sat.launchYear} />
              </View>

            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ── Mini strip ──
  miniStrip: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#0f172a',
    borderTopWidth: 3,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20,
  },
  miniLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  miniDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  miniName: { fontSize: 13, fontWeight: '800', fontFamily: MONO },
  miniStatus: { fontSize: 11, fontFamily: MONO, marginTop: 2 },
  miniBtns: { flexDirection: 'row', alignItems: 'center' },

  // ── Expanded Modal ──
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 3,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginTop: 10, marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flex: 1, marginRight: 8 },
  satName: { fontSize: 17, fontWeight: '800', letterSpacing: 0.5, fontFamily: MONO },
  noradId: { fontSize: 11, color: '#475569', fontFamily: MONO, marginTop: 2 },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { backgroundColor: '#1e293b', padding: 7, borderRadius: 20 },
  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { color: '#64748b', marginTop: 12, fontSize: 13 },
  body: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: '#475569',
    letterSpacing: 1.5, fontFamily: MONO,
    marginTop: 16, marginBottom: 6,
  },
  card: {
    backgroundColor: '#1e293b', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1, borderColor: '#1e3a5f',
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#0f172a',
  },
  infoLabel: { fontSize: 12, color: '#64748b', fontFamily: MONO },
  infoValue: { fontSize: 12, fontWeight: '700', fontFamily: MONO },
  airspaceCard: { borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 14 },
  airspaceText: { fontSize: 13, fontWeight: '700', fontFamily: MONO },
  airspaceSub: { fontSize: 11, color: '#64748b', fontFamily: MONO, marginTop: 4 },
  passCard: {
    backgroundColor: '#1e293b', borderRadius: 10,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#1e3a5f',
  },
  passRow: { flexDirection: 'row', alignItems: 'center' },
  passElBadge: {
    width: 54, height: 54, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  passElText: { fontSize: 16, fontWeight: '800', fontFamily: MONO },
  passElSub: { fontSize: 8, fontWeight: '700', fontFamily: MONO, letterSpacing: 1 },
  passInfo: { flex: 1 },
  passTime: { fontSize: 13, fontWeight: '800', color: '#f1f5f9', fontFamily: MONO, marginBottom: 4 },
  passWindow: { fontSize: 11, color: '#64748b', fontFamily: MONO },
});
