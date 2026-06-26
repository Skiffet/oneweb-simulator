import React, { useState, useEffect, useRef } from "react";
import {
  Animated,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiPost } from "../api";

const BG = require("../images/alexas_fotos-satellite-2771128.jpg");

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const contentFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 45, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2500, useNativeDriver: false }),
      ])
    ).start();

  }, []);

  const glowBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(56,189,248,0.15)", "rgba(56,189,248,0.6)"],
  });
  const glowShadowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 14],
  });

  const pressIn = () =>
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(btnScale, { toValue: 1, friction: 3, useNativeDriver: true }).start();

  const clearError = () => setError("");

  const handleLogin = async () => {
    if (!email || !password) { setError("กรุณากรอกอีเมลและรหัสผ่าน"); return; }
    setLoading(true); clearError();
    try {
      const data = await apiPost("/api/auth/login", { email, password });
      if (data.error) { setError(data.error); return; }
      onLogin(data.user, data.token);
    } catch {
      setError("เชื่อมต่อ server ไม่ได้ ตรวจสอบ IP และ network");
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!email || !password) { setError("กรุณากรอกอีเมลและรหัสผ่าน"); return; }
    setLoading(true); clearError();
    try {
      const data = await apiPost("/api/auth/register", { email, password });
      if (data.error) { setError(data.error); return; }
      onLogin(data.user, data.token);
    } catch {
      setError("เชื่อมต่อ server ไม่ได้ ตรวจสอบ IP และ network");
    } finally { setLoading(false); }
  };

  const switchMode = (next) => {
    Animated.sequence([
      Animated.timing(contentFade, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(contentFade, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setTimeout(() => { setMode(next); clearError(); setPassword(""); }, 150);
  };

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.center}
      >
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          <Animated.View
            style={[
              styles.glowRing,
              {
                borderColor: glowBorderColor,
                shadowRadius: glowShadowRadius,
                shadowColor: "#38bdf8",
                shadowOpacity: 1,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          />

          <View style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.appTitle}>OneWeb Core</Text>
            </View>
            <Text style={styles.appSub}>◈  NETWORK SIMULATOR  ◈</Text>

            <View style={styles.divider} />

            <Animated.View style={{ width: "100%", opacity: contentFade }}>
              <Text style={styles.cardTitle}>
                {mode === "login" ? "[ เข้าสู่ระบบ ]" : "[ สร้างบัญชีใหม่ ]"}
              </Text>

              <TextInput
                style={[styles.input, emailFocused && styles.inputFocused]}
                placeholder="อีเมล"
                placeholderTextColor="#3a5a7a"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => { setEmail(t); clearError(); }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                editable={!loading}
              />

              <TextInput
                style={[styles.input, passwordFocused && styles.inputFocused]}
                placeholder="รหัสผ่าน"
                placeholderTextColor="#3a5a7a"
                secureTextEntry
                value={password}
                onChangeText={(t) => { setPassword(t); clearError(); }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                editable={!loading}
              />

              {error !== "" && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠  {error}</Text>
                </View>
              )}

              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <Pressable
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={mode === "login" ? handleLogin : handleRegister}
                  onPressIn={pressIn}
                  onPressOut={pressOut}
                  disabled={loading}
                >
                  <Text style={styles.primaryBtnText}>
                    {loading
                      ? "◌  กำลังดำเนินการ..."
                      : mode === "login"
                      ? "เข้าสู่ระบบ"
                      : "สมัครสมาชิก"}
                  </Text>
                </Pressable>
              </Animated.View>

              <View style={styles.switchRow}>
                {mode === "login" ? (
                  <>
                    <Text style={styles.switchText}>ยังไม่มีบัญชี?  </Text>
                    <Pressable onPress={() => switchMode("register")}>
                      <Text style={styles.link}>สมัครสมาชิก →</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.switchText}>มีบัญชีแล้ว?  </Text>
                    <Pressable onPress={() => switchMode("login")}>
                      <Text style={styles.link}>← เข้าสู่ระบบ</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const MONO = Platform.OS === "ios" ? "Courier" : "monospace";

const styles = StyleSheet.create({
  bg: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,8,20,0.72)",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  glowRing: {
    position: "absolute",
    top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 10,
  },
  card: {
    width: 320,
    backgroundColor: "rgba(4,16,34,0.92)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.12)",
    borderRadius: 14,
    padding: 30,
    alignItems: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "flex-end" },
  appTitle: {
    color: "#38bdf8",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 2,
    textShadowColor: "rgba(56,189,248,0.7)",
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  appSub: {
    color: "#1e3a52",
    fontSize: 9,
    letterSpacing: 3,
    marginTop: 5,
    fontFamily: MONO,
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(56,189,248,0.12)",
    marginVertical: 20,
  },
  cardTitle: {
    color: "#4a8fa8",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 14,
    alignSelf: "flex-start",
    letterSpacing: 1.5,
    fontFamily: MONO,
  },
  input: {
    width: "100%",
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.18)",
    borderRadius: 6,
    paddingHorizontal: 14,
    color: "#c0e8ff",
    backgroundColor: "rgba(0,12,28,0.85)",
    marginBottom: 10,
    fontSize: 13,
    fontFamily: MONO,
  },
  inputFocused: {
    borderColor: "#38bdf8",
    backgroundColor: "rgba(0,22,48,0.95)",
    shadowColor: "#38bdf8",
    shadowRadius: 8,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  primaryBtn: {
    width: "100%",
    height: 44,
    backgroundColor: "rgba(14,165,233,0.12)",
    borderWidth: 1,
    borderColor: "#0ea5e9",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  btnDisabled: {
    backgroundColor: "rgba(14,165,233,0.04)",
    borderColor: "rgba(14,165,233,0.25)",
  },
  primaryBtnText: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
    fontFamily: MONO,
  },
  errorBox: {
    width: "100%",
    backgroundColor: "rgba(248,113,113,0.08)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  errorText: { color: "#f87171", fontSize: 11, fontFamily: MONO },
  switchRow: {
    flexDirection: "row",
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  switchText: { color: "#2a4a62", fontSize: 11, fontFamily: MONO },
  link: { color: "#38bdf8", fontSize: 11, fontWeight: "600", fontFamily: MONO },
});
