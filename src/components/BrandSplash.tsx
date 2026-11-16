import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

/** Soft glowing wave built from a huge rotated, rounded gradient slab (no SVG dependency). */
export function Wave({ top, bottom, rotate, colors: c, opacity = 1 }: { top?: number; bottom?: number; rotate: string; colors: readonly [string, string, ...string[]]; opacity?: number }) {
  return (
    <View pointerEvents="none" style={[st.waveWrap, { top, bottom, opacity, transform: [{ rotate }] }]}>
      <LinearGradient colors={c} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={st.wave} />
    </View>
  );
}

export function BrandSplash({ done, onFinish }: { done: boolean; onFinish: () => void }) {
  const logo = useState(() => new Animated.Value(0))[0];
  const text = useState(() => new Animated.Value(0))[0];
  const spin = useState(() => new Animated.Value(0))[0];
  const exit = useState(() => new Animated.Value(1))[0];
  const introDone = useRef(false);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(logo, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.timing(text, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => { introDone.current = true; });
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })).start();
  }, [logo, text, spin]);

  useEffect(() => {
    if (!done) return;
    const t = setInterval(() => {
      if (!introDone.current) return;
      clearInterval(t);
      Animated.timing(exit, { toValue: 0, duration: 380, delay: 250, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(onFinish);
    }, 50);
    return () => clearInterval(t);
  }, [done, exit, onFinish]);

  const rise = (v: Animated.Value, d = 14) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [d, 0] }) }] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: exit, zIndex: 100 }]} pointerEvents="none">
      <LinearGradient colors={["#120B2B", "#22154F", "#1A1040"]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <Wave top={-150} rotate="-14deg" colors={["#F2994A", "#8A5BE8", "rgba(74,47,158,0)"]} opacity={0.55} />
      <Wave top={-190} rotate="-8deg" colors={["#4A2F9E", "#2A1B5E"]} opacity={0.9} />
      <Wave bottom={-170} rotate="-12deg" colors={["rgba(74,47,158,0)", "#8A5BE8", "#F2B54A"]} opacity={0.55} />
      <Wave bottom={-210} rotate="-6deg" colors={["#2A1B5E", "#4A2F9E"]} opacity={0.9} />

      <View style={st.center}>
        <Animated.View style={[st.logoTile, { opacity: logo, transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
          <Image source={require("../../assets/images/crm-icon.png")} style={{ width: 60, height: 60 }} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[{ alignItems: "center", marginTop: 26 }, rise(text)]}>
          <Text style={st.word}>RMW <Text style={{ color: colors.gold }}>CRM</Text></Text>
          <Text style={st.tag}>LEAD MANAGEMENT SYSTEM</Text>
        </Animated.View>

        <Animated.View style={[{ alignItems: "center", marginTop: 56 }, { opacity: text }]}>
          <View style={st.spinTrack}>
            <Animated.View style={[st.spinArc, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]} />
          </View>
          <Text style={st.loading}>Loading…</Text>
          <Text style={st.loadingSub}>Setting up your workspace</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}


const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  waveWrap: { position: "absolute", left: -160, right: -160, height: 300 },
  wave: { flex: 1, borderRadius: 300 },
  logoTile: { width: 104, height: 104, borderRadius: 30, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#8A5BE8", shadowOpacity: 0.55, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 16 },
  word: { color: "#fff", fontSize: 36, fontWeight: "800", letterSpacing: 0.5 },
  tag: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 10, letterSpacing: 4, fontWeight: "600" },
  spinTrack: { width: 54, height: 54, borderRadius: 27, borderWidth: 4, borderColor: "rgba(255,255,255,0.08)" },
  spinArc: { position: "absolute", top: -4, left: -4, width: 54, height: 54, borderRadius: 27, borderWidth: 4, borderColor: "transparent", borderTopColor: colors.gold, borderRightColor: "#8A5BE8" },
  loading: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 20 },
  loadingSub: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 },
});
