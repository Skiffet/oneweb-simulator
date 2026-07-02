import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import LoginScreen from "./screens/LoginScreen";
import SatelliteMapScreen from "./screens/SatelliteMapScreen";
import { API_URL } from "./api";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;  // 15 นาที
const WARN_BEFORE_MS = 60 * 1000;         // เตือน 1 นาทีก่อน logout

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef(null);
  const warnTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowIdleWarning(false);

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);

    warnTimerRef.current = setTimeout(() => {
      setShowIdleWarning(true);
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);

    idleTimerRef.current = setTimeout(() => {
      handleLogout();
    }, IDLE_TIMEOUT_MS);
  }, []);

  const handleLogin = useCallback((userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    resetTimers();
  }, [resetTimers]);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    setShowIdleWarning(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
  }, []);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetch(`${API_URL}/api/auth/heartbeat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const handleActivity = useCallback(() => {
    if (user) resetTimers();
  }, [user, resetTimers]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active" &&
        user
      ) {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= IDLE_TIMEOUT_MS) {
          handleLogout();
        } else {
          resetTimers();
        }
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [user, handleLogout, resetTimers]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    };
  }, []);

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <View style={styles.root} onTouchStart={handleActivity} onTouchMove={handleActivity}>
      <SatelliteMapScreen onLogout={handleLogout} token={token} user={user} />

      <Modal visible={showIdleWarning} transparent animationType="fade">
        <View style={styles.warningOverlay}>
          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>⏱</Text>
            <Text style={styles.warningTitle}>ระบบจะออกจากระบบเร็วๆ นี้</Text>
            <Text style={styles.warningBody}>
              คุณไม่ได้ใช้งานนานกว่า 14 นาที{"\n"}ระบบจะออกจากระบบใน 1 นาที
            </Text>
            <Pressable style={styles.warningBtn} onPress={resetTimers}>
              <Text style={styles.warningBtnText}>ยังคงอยู่ในระบบ</Text>
            </Pressable>
            <Pressable style={styles.logoutLinkBtn} onPress={handleLogout}>
              <Text style={styles.logoutLinkText}>ออกจากระบบทันที</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const MONO = Platform.OS === "ios" ? "Courier" : "monospace";

const styles = StyleSheet.create({
  root: { flex: 1 },
  warningOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  warningCard: {
    width: 300,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    shadowColor: "#fbbf24",
    shadowRadius: 20,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  warningIcon: { fontSize: 36, marginBottom: 12 },
  warningTitle: {
    color: "#fbbf24",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  warningBody: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
    fontFamily: MONO,
  },
  warningBtn: {
    width: "100%",
    height: 44,
    backgroundColor: "rgba(251,191,36,0.15)",
    borderWidth: 1,
    borderColor: "#fbbf24",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  warningBtnText: {
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    fontFamily: MONO,
  },
  logoutLinkBtn: { paddingVertical: 8 },
  logoutLinkText: {
    color: "#f87171",
    fontSize: 11,
    fontFamily: MONO,
    textDecorationLine: "underline",
  },
});
