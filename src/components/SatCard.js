import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const SatCard = React.memo(({ sat }) => {
  const isOneweb = sat.name && sat.name.toUpperCase().includes('ONEWEB');
  const isThaiAirspace = sat.lat >= 5.6 && sat.lat <= 20.5 && sat.lon >= 97.3 && sat.lon <= 105.6;

  return (
    <View style={styles.satCard}>
      <View style={styles.satCardTop}>
        <Text style={styles.satCardTitle} numberOfLines={1}>{sat.name || `OBJECT ${sat.noradId}`}</Text>
        <View style={styles.badgesRight}>
          {isOneweb && (
            <View style={[styles.badge, { backgroundColor: '#dbeafe' }]}>
              <Text style={[styles.badgeText, { color: '#1d4ed8' }]}>ONEWEB</Text>
            </View>
          )}
          {sat.isTurnedOff && (
            <View style={[styles.badge, { backgroundColor: '#f1f5f9' }]}>
              <Text style={[styles.badgeText, { color: '#64748b' }]}>MUTED</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.satCardBottom}>
        <View style={[styles.badgeOutline, { borderColor: '#e2e8f0' }]}>
          <Text style={[styles.badgeText, { color: '#64748b' }]}>ID: {sat.noradId}</Text>
        </View>
        <View style={[styles.badgeOutline, { borderColor: '#e2e8f0' }]}>
          <Text style={[styles.badgeText, { color: '#64748b' }]}>ALT: {sat.alt?.toFixed(1) || 'N/A'} KM</Text>
        </View>
        {isThaiAirspace && (
          <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.badgeText, { color: '#166534' }]}>TH AIRSPACE</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  satCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  satCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  satCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  badgesRight: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  satCardBottom: {
    flexDirection: 'row',
    gap: 8,
  },
  badgeOutline: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
});
