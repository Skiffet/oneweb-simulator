import React from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export const StyledSwitchRow = ({ title, icon, color, active, onToggle, extraBtn }) => (
  <View style={[styles.switchRow, { borderColor: active ? color : '#e2e8f0', backgroundColor: active ? `${color}10` : '#ffffff' }]}>
    <View style={styles.switchLeft}>
      {icon && <Feather name={icon} size={14} color={active ? color : '#94a3b8'} style={{ marginRight: 8 }} />}
      <Text style={[styles.switchText, { color: active ? '#1e293b' : '#64748b' }]}>{title}</Text>
    </View>
    <View style={styles.switchRight}>
      {extraBtn && active && (
        <TouchableOpacity style={[styles.extraBtn, { backgroundColor: color }]}>
          <Text style={styles.extraBtnText}>{extraBtn}</Text>
        </TouchableOpacity>
      )}
      <Switch 
        value={active} 
        onValueChange={onToggle}
        trackColor={{ false: '#e2e8f0', true: `${color}80` }}
        thumbColor={active ? color : '#f8fafc'}
        ios_backgroundColor="#e2e8f0"
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  switchRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  extraBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  extraBtnText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
