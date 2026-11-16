import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import {
  ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { initials } from "@/lib/format";
import { colors, gradients, shadow, statusTone, websiteTone } from "@/lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function T({ style, muted, bold, size = 15, children, numberOfLines }: {
  style?: StyleProp<TextStyle>; muted?: boolean; bold?: boolean; size?: number; children: ReactNode; numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: muted ? colors.textMuted : colors.text, fontSize: size, fontWeight: bold ? "700" : "400", letterSpacing: bold ? -0.2 : 0 }, style]}>
      {children}
    </Text>
  );
}

/** Scrollable page body with pull-to-refresh. */
export function Screen({ children, refreshing, onRefresh, padded = true }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; padded?: boolean }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.page }}
      contentContainerStyle={[padded && { paddingHorizontal: 16, paddingTop: 8, gap: 14 }, { paddingBottom: 120 }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/** Native large-title header (iOS / modern Android style), sits on the page background. */
export function Header({ title, subtitle, right, eyebrow, onBack }: { title: string; subtitle?: string; right?: ReactNode; eyebrow?: string; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: colors.page, flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
      {onBack ? <IconButton icon="chevron-back" onPress={onBack} /> : null}
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 2 }}>{eyebrow}</Text> : null}
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.6 }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({ icon, onPress, badge, tone = colors.text }: { icon: IconName; onPress?: () => void; badge?: number; tone?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [st.iconBtn, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Ionicons name={icon} size={21} color={tone} />
      {badge ? <View style={st.dot}><Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{badge > 9 ? "9+" : badge}</Text></View> : null}
    </Pressable>
  );
}

/** Section label above a card group, sentence case like native settings screens. */
export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4 }}>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: colors.text, letterSpacing: -0.3 }}>{title}</Text>
        {action ? <Text onPress={onAction} style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>{action}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style, title, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; title?: string; padded?: boolean }) {
  const body = <View style={[st.card, padded && { padding: 16, gap: 12 }, style]}>{children}</View>;
  return title ? <Section title={title}>{body}</Section> : body;
}

export function Badge({ label, bg, fg, dot }: { label: string; bg: string; fg: string; dot?: boolean }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5 }}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} /> : null}
      <Text style={{ color: fg, fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export const StatusBadge = ({ name, color }: { name: string; color?: string | null }) => {
  const t = statusTone[color || "slate"] ?? statusTone.slate!;
  return <Badge label={name} bg={t.bg} fg={t.fg} dot />;
};

export const WebsiteBadge = ({ code }: { code?: string | null }) => {
  if (!code) return null;
  const t = websiteTone[code] ?? { ...statusTone.slate!, solid: colors.primary };
  return <Badge label={code} bg={t.bg} fg={t.fg} />;
};

const AVATAR_PALETTE = ["#5B3FD6", "#7C5CFF", "#13A89A", "#E5484D", "#E8A23A", "#F2994A", "#3E6CF0", "#D6409F"];
export function Avatar({ name, size = 44, tone, src }: { name?: string | null; size?: number; tone?: string; src?: string | null }) {
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#E9EBF3" }} accessibilityLabel={name ? `${name}'s photo` : undefined} />;
  const hash = [...String(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = tone ?? AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${bg}1F`, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: bg, fontWeight: "800", fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

type BtnProps = { title: string; onPress?: () => void; icon?: IconName; variant?: "primary" | "outline" | "ghost" | "success" | "soft"; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; size?: "md" | "lg" | "sm" };
export function Button({ title, onPress, icon, variant = "primary", loading, disabled, style, size = "md" }: BtnProps) {
  const h = size === "lg" ? 56 : size === "sm" ? 36 : 48;
  const fg = variant === "primary" || variant === "success" ? "#fff" : variant === "soft" ? colors.primary : variant === "ghost" ? colors.primary : colors.text;
  const content = (
    <>
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Ionicons name={icon} size={size === "sm" ? 15 : 18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "700", fontSize: size === "sm" ? 13 : 16, letterSpacing: -0.2 }}>{title}</Text>
    </>
  );
  const press = () => { void Haptics.selectionAsync(); onPress?.(); };
  return (
    <Pressable onPress={press} disabled={disabled || loading} style={({ pressed }) => [{ opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      {variant === "primary" ? (
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.btn, { height: h, borderRadius: h / 2.6 }]}>{content}</LinearGradient>
      ) : (
        <View style={[st.btn, { height: h, borderRadius: h / 2.6 },
          variant === "success" && { backgroundColor: colors.whatsapp },
          variant === "outline" && { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
          variant === "soft" && { backgroundColor: colors.primarySoft },
        ]}>{content}</View>
      )}
    </Pressable>
  );
}

export function Input({ label, icon, style, secureTextEntry, ...props }: TextInputProps & { label?: string; icon?: IconName }) {
  const [focus, setFocus] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  return (
    <View style={{ gap: 7 }}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <View style={[st.field, focus && st.fieldFocus, props.multiline && { alignItems: "flex-start", paddingVertical: 4 }]}>
        {icon ? <Ionicons name={icon} size={19} color={focus ? colors.primary : colors.textFaint} style={props.multiline ? { marginTop: 12 } : undefined} /> : null}
        <TextInput
          placeholderTextColor={colors.textFaint}
          onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
          secureTextEntry={hidden}
          style={[{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: 14 }, props.multiline && { minHeight: 84, textAlignVertical: "top" }, style]}
          {...props}
        />
        {secureTextEntry ? <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textFaint} onPress={() => setHidden((h) => !h)} /> : null}
      </View>
    </View>
  );
}

export function Chip({ label, active, onPress, icon, dark, count }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName; dark?: boolean; count?: number }) {
  const fg = active ? "#fff" : dark ? "rgba(255,255,255,0.85)" : colors.text;
  return (
    <Pressable
      onPress={() => { void Haptics.selectionAsync(); onPress?.(); }}
      style={[st.chip, dark && st.chipDark, active && (dark ? { backgroundColor: "#fff", borderColor: "#fff" } : { backgroundColor: colors.primary, borderColor: colors.primary })]}
    >
      {icon ? <Ionicons name={icon} size={14} color={active && dark ? colors.primary : active ? "#fff" : dark ? "rgba(255,255,255,0.7)" : colors.textMuted} /> : null}
      <Text style={{ color: active && dark ? colors.primary : fg, fontSize: 14, fontWeight: "600" }}>{label}{count !== undefined ? ` (${count})` : ""}</Text>
    </Pressable>
  );
}

export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  return (
    <View style={[st.search]}>
      <Ionicons name="search" size={18} color={colors.textFaint} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textFaint} style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: colors.text }} returnKeyType="search" />
      {value ? <Ionicons name="close-circle" size={18} color={colors.textFaint} onPress={() => onChangeText("")} /> : null}
    </View>
  );
}

export function EmptyState({ icon = "file-tray-outline", title, text }: { icon?: IconName; title: string; text?: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 56, gap: 10 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <T bold size={17}>{title}</T>
      {text ? <T muted size={14} style={{ textAlign: "center", paddingHorizontal: 32 }}>{text}</T> : null}
    </View>
  );
}

export function Loading() {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 48 }}><ActivityIndicator color={colors.primary} size="large" /></View>;
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ alignItems: "center", padding: 32, gap: 12 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.dangerSoft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
      </View>
      <T muted style={{ textAlign: "center" }}>{message}</T>
      {onRetry ? <Button title="Try again" variant="soft" onPress={onRetry} /> : null}
    </View>
  );
}

export const s = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text },
});

const st = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, ...shadow.card },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginLeft: 2 },
  field: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, backgroundColor: "#FAF9FE", paddingHorizontal: 14 },
  fieldFocus: { borderColor: colors.primary, backgroundColor: "#fff" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 },
  chipDark: { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.18)" },
  search: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 14, ...shadow.card },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.card },
  dot: { position: "absolute", top: 4, right: 4, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 3, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
});
