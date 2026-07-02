import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { API_URL } from '../api';

export default function AdminScreen({ token, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/active-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setUsers(json.users || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveUsers();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ACTIVE USERS</Text>
        <Text style={styles.subtitle}>ผู้ใช้งานใน 15 นาทีล่าสุด</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕ ปิด</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0ea5e9" style={{ marginTop: 40 }} />
      ) : users.length === 0 ? (
        <Text style={styles.empty}>ไม่มีผู้ใช้งานออนไลน์</Text>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.dot} />
              <View>
                <Text style={styles.email}>{item.email}</Text>
                <Text style={styles.time}>
                  ใช้งานล่าสุด: {new Date(item.last_seen).toLocaleTimeString('th-TH')}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.refreshBtn} onPress={fetchActiveUsers}>
        <Text style={styles.refreshText}>รีเฟรช</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  header: { marginBottom: 20, marginTop: 40 },
  title: { color: '#0ea5e9', fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  subtitle: { color: '#64748b', fontSize: 13, marginTop: 4 },
  closeBtn: { position: 'absolute', right: 0, top: 0, padding: 8 },
  closeText: { color: '#f87171', fontSize: 14 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22c55e', marginRight: 12,
  },
  email: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  time: { color: '#64748b', fontSize: 12, marginTop: 2 },
  refreshBtn: {
    backgroundColor: '#0ea5e9', borderRadius: 8,
    padding: 14, alignItems: 'center', marginTop: 16,
  },
  refreshText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
