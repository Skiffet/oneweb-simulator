import React, { useState, useEffect, useRef } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { apiPost } from "../api";

const LOGO = require("../images/nt-logo.png");

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
  const btnScale = useRef(new Animated.Value(1)).current;
  const btnScale2 = useRef(new Animated.Value(1)).current;
  const contentFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 45, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const pressIn = (anim) => () =>
    Animated.spring(anim, { toValue: 0.96, useNativeDriver: true }).start();
  const pressOut = (anim) => () =>
    Animated.spring(anim, { toValue: 1, friction: 3, useNativeDriver: true }).start();

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
    if (next === mode) return;
    Animated.sequence([
      Animated.timing(contentFade, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(contentFade, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setTimeout(() => { setMode(next); clearError(); setPassword(""); }, 150);
  };

  return (
    <LinearGradient
      colors={["#F5A400", "#FFC933", "#FFE9A0"]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.bg}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.center}
      >
        <Animated.View
          style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.logoWrap}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.appTitle}>OneWeb Core</Text>
          <Text style={styles.appSub}>NETWORK SIMULATOR</Text>

          <View style={styles.dots}>
            <View style={[styles.dot, mode === "login" && styles.dotActive]} />
            <View style={[styles.dot, mode === "register" && styles.dotActive]} />
          </View>

          <Animated.View style={{ width: "100%", opacity: contentFade }}>
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused]}
              placeholder="อีเมล"
              placeholderTextColor="rgba(82,86,91,0.6)"
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
              placeholderTextColor="rgba(82,86,91,0.6)"
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
                style={[
                  styles.pillBtn,
                  mode === "login" && styles.pillBtnPrimary,
                  loading && styles.btnDisabled,
                ]}
                onPress={mode === "login" ? handleLogin : () => switchMode("login")}
                onPressIn={pressIn(btnScale)}
                onPressOut={pressOut(btnScale)}
                disabled={loading}
              >
                <Text style={[styles.pillBtnText, mode === "login" && styles.pillBtnTextPrimary]}>
                  {loading && mode === "login" ? "กำลังดำเนินการ..." : "Sign In"}
                </Text>
              </Pressable>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: btnScale2 }] }}>
              <Pressable
                style={[
                  styles.pillBtn,
                  mode === "register" && styles.pillBtnPrimary,
                  loading && styles.btnDisabled,
                ]}
                onPress={mode === "register" ? handleRegister : () => switchMode("register")}
                onPressIn={pressIn(btnScale2)}
                onPressOut={pressOut(btnScale2)}
                disabled={loading}
              >
                <Text style={[styles.pillBtnText, mode === "register" && styles.pillBtnTextPrimary]}>
                  {loading && mode === "register" ? "กำลังดำเนินการ..." : "Register"}
                </Text>
              </Pressable>
            </Animated.View>
          </Animated.View>

          <Text style={styles.terms}>
            By continuing you accept our{"\n"}Terms of Service and Privacy Policy
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: "100%", height: "100%" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { width: 320, alignItems: "center" },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  logo: { width: 68, height: 68 },
  appTitle: {
    color: "#4a4d52",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  appSub: {
    color: "rgba(74,77,82,0.75)",
    fontSize: 11,
    letterSpacing: 3,
    marginTop: 6,
  },
  dots: {
    flexDirection: "row",
    marginTop: 26,
    marginBottom: 26,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(74,77,82,0.35)",
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: "#4a4d52",
    width: 20,
  },
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1.5,
    borderColor: "rgba(74,77,82,0.35)",
    borderRadius: 24,
    paddingHorizontal: 20,
    color: "#3a3d42",
    backgroundColor: "rgba(255,255,255,0.55)",
    marginBottom: 12,
    fontSize: 14,
  },
  inputFocused: {
    borderColor: "#4a4d52",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  pillBtn: {
    width: "100%",
    height: 48,
    borderWidth: 1.5,
    borderColor: "rgba(74,77,82,0.55)",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  pillBtnPrimary: {
    backgroundColor: "#4a4d52",
    borderColor: "#4a4d52",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  pillBtnText: {
    color: "#4a4d52",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  pillBtnTextPrimary: {
    color: "#ffffff",
  },
  errorBox: {
    width: "100%",
    backgroundColor: "rgba(180,40,40,0.12)",
    borderWidth: 1,
    borderColor: "rgba(180,40,40,0.4)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  errorText: { color: "#7a1f1f", fontSize: 12 },
  terms: {
    color: "rgba(74,77,82,0.7)",
    fontSize: 10,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 15,
  },
});
