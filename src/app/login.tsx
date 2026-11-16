import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Animated, Easing, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OtpInput } from "@/components/OtpInput";
import { Button, Input } from "@/components/ui";
import { api, apiMessage, CRM_URL } from "@/lib/api";
import { colors, gradients, shadow } from "@/lib/theme";

type Step = { kind: "intro" } | { kind: "credentials" } | { kind: "otp"; masked?: string; reason?: string };
const RESEND_SECONDS = 30;

export default function Login() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"password" | "mobile">("password");
  const [step, setStep] = useState<Step>({ kind: "intro" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [trust, setTrust] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const enter = useState(() => new Animated.Value(0))[0];
  const shake = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, step.kind]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const fail = (msg: string) => {
    setError(msg);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shake.setValue(0);
    Animated.sequence([10, -10, 6, -6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true }))).start();
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { fail(apiMessage(e)); } finally { setBusy(false); }
  };

  const signedIn = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await qc.invalidateQueries({ queryKey: ["me"] });
  };

  const submit = () => run(async () => {
    if (mode === "password") {
      const r = await api<{ requiresOtp: boolean; maskedMobile?: string; reason?: string }>("/auth/login", { method: "POST", body: { email: email.trim(), password } });
      if (r.requiresOtp) { setStep({ kind: "otp", masked: r.maskedMobile, reason: r.reason }); setResendIn(RESEND_SECONDS); } else await signedIn();
    } else {
      await api("/auth/otp/send", { method: "POST", body: { mobile: mobile.trim() } });
      const d = mobile.replace(/\D/g, "").slice(-10);
      setStep({ kind: "otp", masked: `+91 ••••• ${d.slice(-5)}` });
      setResendIn(RESEND_SECONDS);
    }
  });

  const verify = (code = otp) => run(async () => {
    await api("/auth/otp/verify", { method: "POST", body: { otp: code, trustDevice: trust, trustDays: trust ? 30 : undefined } });
    await signedIn();
  });

  const onOtp = (v: string) => {
    setOtp(v);
    setError(null);
    if (v.length === 6 && !busy) verify(v);
  };

  const resend = () => run(async () => { await api("/auth/otp/resend", { method: "POST" }); setResendIn(RESEND_SECONDS); setOtp(""); });

  const fadeIn = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] };
  const canSubmit = mode === "password" ? /\S+@\S+\.\S+/.test(email) && password.length > 0 : mobile.replace(/\D/g, "").length >= 10;

  if (step.kind === "intro") {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <LinearGradient colors={["#EDE6FF", "#FFFFFF"]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0.6 }} style={StyleSheet.absoluteFill} />
        <View style={[st.orb, { top: -60, right: -80, width: 260, height: 260, backgroundColor: "#D9CCFF", opacity: 0.5 }]} />
        <Animated.View style={[{ flex: 1, paddingTop: insets.top + 28, paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }, fadeIn]}>
          <Brand />
          <Text style={[st.big, { marginTop: 44 }]}>Manage leads.</Text>
          <Text style={[st.big, { color: colors.primary }]}>Close deals sooner.</Text>
          <Text style={st.lead}>Every enquiry from MPF, RMW and CT lands here. Assign, call, follow up and track conversions on the go.</Text>

          <View style={st.illo}>
            <View style={[st.panelCard, { flex: 1 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="bar-chart" size={14} color={colors.primary} />
                <Text style={{ fontWeight: "700", color: colors.text, fontSize: 13 }}>Pipeline</Text>
              </View>
              <View style={st.bars}>
                {[22, 34, 28, 48, 60, 78].map((h, i) => <View key={i} style={[st.barCol, { height: h, opacity: 0.35 + i * 0.13 }]} />)}
              </View>
            </View>
            <View style={{ gap: 10 }}>
              {([["person-add", colors.violet], ["calendar", colors.saffron], ["checkmark-circle", colors.success]] as const).map(([ic, tone]) => (
                <View key={ic} style={st.illoChip}><Ionicons name={ic} size={20} color={tone} /></View>
              ))}
            </View>
          </View>

          <View style={{ flex: 1 }} />
          <Pressable onPress={() => { void Haptics.selectionAsync(); setStep({ kind: "credentials" }); }} style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.cta}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>Get started</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" style={{ position: "absolute", right: 22 }} />
            </LinearGradient>
          </Pressable>
          <Text style={st.footer}>Ritz Media World · Lead Management</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <LinearGradient colors={["#FFFFFF", "#FFFFFF", "#F1ECFF"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 36, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={[{ alignItems: "center" }, fadeIn]}>
            <Brand center />
            <Text style={st.title}>{step.kind === "otp" ? "Verify it's you" : "Sign in to your account"}</Text>
            <Text style={st.sub}>{step.kind === "otp" ? "One last step to keep your leads secure." : "Access your CRM and manage leads on the go."}</Text>
          </Animated.View>

          <Animated.View style={[{ gap: 16, marginTop: 28 }, fadeIn]}>
            <Animated.View style={{ gap: 16, transform: [{ translateX: shake }] }}>
              {step.kind === "credentials" ? (
                <>
                  {mode === "password" ? (
                    <View style={{ gap: 14 }}>
                      <Input icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" placeholder="Enter your email" returnKeyType="next" />
                      <Input icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" placeholder="Enter your password" returnKeyType="go" onSubmitEditing={() => canSubmit && submit()} />
                      <Text style={st.link} onPress={() => void Linking.openURL(`${CRM_URL}/forgot-password`)}>Forgot password?</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      <Input icon="call-outline" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" maxLength={13} placeholder="Registered mobile number" autoComplete="tel" />
                      <Text style={st.hint}>We&apos;ll text a 6-digit code to this number.</Text>
                    </View>
                  )}

                  {error ? <ErrorLine text={error} /> : null}
                  <Button title={mode === "password" ? "Sign in" : "Send code"} size="lg" onPress={submit} loading={busy} disabled={!canSubmit} />

                  <View style={st.divider}>
                    <View style={st.line} /><Text style={st.hint}>or</Text><View style={st.line} />
                  </View>
                  <Pressable
                    onPress={() => { void Haptics.selectionAsync(); setMode(mode === "password" ? "mobile" : "password"); setError(null); }}
                    style={({ pressed }) => [st.alt, pressed && { backgroundColor: "#F8F6FE" }]}
                  >
                    <Ionicons name={mode === "password" ? "phone-portrait-outline" : "mail-outline"} size={18} color={colors.primary} />
                    <Text style={{ fontWeight: "700", fontSize: 15, color: colors.text }}>{mode === "password" ? "Sign in with mobile OTP" : "Sign in with email"}</Text>
                  </Pressable>

                  <Text style={[st.hint, { textAlign: "center", marginTop: 8 }]}>
                    Don&apos;t have an account? <Text style={st.linkInline} onPress={() => void Linking.openURL(`${CRM_URL}/register`)}>Request access</Text>
                  </Text>
                </>
              ) : (
                <>
                  <View style={st.otpHead}>
                    <View style={st.otpIcon}><Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{step.reason === "NEW_DEVICE" ? "New device detected" : "Enter the code"}</Text>
                      <Text style={st.hint}>Sent to {step.masked || "your registered mobile"}</Text>
                    </View>
                  </View>
                  <OtpInput value={otp} onChange={onOtp} error={!!error} />
                  {error ? <ErrorLine text={error} /> : null}
                  <View style={st.trust}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Trust this device</Text>
                      <Text style={st.hint}>Skip the code here for 30 days</Text>
                    </View>
                    <Switch value={trust} onValueChange={setTrust} trackColor={{ true: colors.primary, false: "#DDD8EE" }} thumbColor="#fff" />
                  </View>
                  <Button title="Verify & sign in" size="lg" onPress={() => verify()} loading={busy} disabled={otp.length < 4} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Pressable onPress={() => { setStep({ kind: "credentials" }); setOtp(""); setError(null); }} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Back</Text>
                    </Pressable>
                    {resendIn > 0 ? <Text style={st.hint}>Resend in 0:{String(resendIn).padStart(2, "0")}</Text> : <Text style={st.link} onPress={resend}>Resend code</Text>}
                  </View>
                </>
              )}
            </Animated.View>
          </Animated.View>

          <View style={{ flex: 1, minHeight: 24 }} />
          <View style={st.secure}>
            <Ionicons name="shield-checkmark" size={14} color={colors.success} />
            <Text style={st.secureText}>Secured with device verification & encrypted sessions</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Brand({ center }: { center?: boolean }) {
  return (
    <View style={{ alignItems: center ? "center" : "flex-start", gap: 8 }}>
      <View style={st.logoTile}><Image source={require("../../assets/images/crm-icon.png")} style={{ width: 40, height: 40 }} resizeMode="contain" /></View>
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.navy }}>RMW <Text style={{ color: colors.gold }}>CRM</Text></Text>
    </View>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <View style={st.error}>
      <Ionicons name="alert-circle" size={17} color={colors.danger} />
      <Text style={{ flex: 1, color: colors.danger, fontSize: 13.5, fontWeight: "500" }}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  orb: { position: "absolute", borderRadius: 999 },
  logoTile: { width: 60, height: 60, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.card },
  big: { color: colors.text, fontSize: 32, fontWeight: "800", letterSpacing: -0.9, lineHeight: 38 },
  lead: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 14, maxWidth: 330 },
  illo: { flexDirection: "row", gap: 12, marginTop: 32, padding: 14, borderRadius: 24, backgroundColor: "rgba(239,234,255,0.7)" },
  panelCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, gap: 12, ...shadow.card },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 7, height: 80 },
  barCol: { flex: 1, borderRadius: 5, backgroundColor: colors.primary },
  illoChip: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", ...shadow.card },
  cta: { height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", ...shadow.float },
  title: { color: colors.text, fontSize: 25, fontWeight: "800", letterSpacing: -0.6, marginTop: 22, textAlign: "center" },
  sub: { color: colors.textMuted, fontSize: 15, lineHeight: 21, marginTop: 6, textAlign: "center", maxWidth: 300 },
  link: { color: colors.primary, fontWeight: "700", fontSize: 14, alignSelf: "flex-end" },
  linkInline: { color: colors.primary, fontWeight: "700", textDecorationLine: "underline" },
  hint: { color: colors.textMuted, fontSize: 13 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  alt: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff" },
  secure: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  secureText: { color: colors.textMuted, fontSize: 12 },
  otpHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  otpIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  trust: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FAF9FE", borderRadius: 16, padding: 14 },
  error: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.dangerSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  footer: { textAlign: "center", color: colors.textFaint, fontSize: 12, marginTop: 14 },
});
