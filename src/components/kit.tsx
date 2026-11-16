import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { IconName } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { colors, shadow } from "@/lib/theme";

/** Light stack header with a back button, for pushed screens. */
export function StackHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.stackHead, { paddingTop: insets.top + 6 }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={st.backBtn} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 13, color: colors.textMuted }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Grouped list like native settings. */
export function Group({ children }: { children: ReactNode }) {
  return <View style={st.group}>{children}</View>;
}

export function ListRow({ icon, tone = colors.primary, label, value, onPress, danger, right, last }: {
  icon: IconName; tone?: string; label: string; value?: string | null; onPress?: () => void; danger?: boolean; right?: ReactNode; last?: boolean;
}) {
  return (
    <>
      <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.row, pressed && { backgroundColor: "#F7F8FB" }]}>
        <View style={[st.rowIcon, { backgroundColor: `${danger ? colors.danger : tone}1A` }]}><Ionicons name={icon} size={18} color={danger ? colors.danger : tone} /></View>
        <Text style={[st.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {value ? <Text style={st.rowValue} numberOfLines={1}>{value}</Text> : null}
        {right ?? (onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null)}
      </Pressable>
      {!last ? <View style={{ height: 1, backgroundColor: "#F0F1F6", marginLeft: 64 }} /> : null}
    </>
  );
}

/** Bottom sheet modal. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={st.backdrop} onPress={onClose} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={st.grabber} />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
            <Text style={{ flex: 1, fontSize: 19, fontWeight: "800", color: colors.text, letterSpacing: -0.3 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={st.close}><Ionicons name="close" size={18} color={colors.textMuted} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type Option<V> = { value: V; label: string; sub?: string };

/** A field that opens a sheet with a list of options (single or multi select). */
export function SelectField<V extends string | number | null>({ label, value, options, onChange, placeholder = "Select", icon }: {
  label?: string; value: V; options: Option<V>[]; onChange: (v: V) => void; placeholder?: string; icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 7 }}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={st.field}>
        {icon ? <Ionicons name={icon} size={19} color={colors.textFaint} /> : null}
        <Text style={{ flex: 1, fontSize: 16, color: current ? colors.text : colors.textFaint }} numberOfLines={1}>{current?.label ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textFaint} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label ?? placeholder}>
        <View style={st.group}>
          {options.map((o, i) => (
            <OptionRow key={String(o.value)} option={o} selected={o.value === value} last={i === options.length - 1} onPress={() => { onChange(o.value); setOpen(false); }} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

export function MultiSelectField<V extends string | number>({ label, values, options, onChange, placeholder = "Select" }: {
  label?: string; values: V[]; options: Option<V>[]; onChange: (v: V[]) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const picked = options.filter((o) => values.includes(o.value));
  return (
    <View style={{ gap: 7 }}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={st.field}>
        <Text style={{ flex: 1, fontSize: 16, color: picked.length ? colors.text : colors.textFaint }} numberOfLines={1}>{picked.length ? picked.map((p) => p.label).join(", ") : placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textFaint} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label ?? placeholder}>
        <View style={st.group}>
          {options.map((o, i) => {
            const on = values.includes(o.value);
            return <OptionRow key={String(o.value)} option={o} selected={on} multi last={i === options.length - 1} onPress={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])} />;
          })}
        </View>
      </Sheet>
    </View>
  );
}

function OptionRow<V>({ option, selected, onPress, last, multi }: { option: Option<V>; selected: boolean; onPress: () => void; last: boolean; multi?: boolean }) {
  return (
    <>
      <Pressable onPress={onPress} style={({ pressed }) => [st.row, pressed && { backgroundColor: "#F7F8FB" }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15.5, fontWeight: selected ? "700" : "500", color: colors.text }}>{option.label}</Text>
          {option.sub ? <Text style={{ fontSize: 13, color: colors.textMuted }}>{option.sub}</Text> : null}
        </View>
        <Ionicons name={multi ? (selected ? "checkbox" : "square-outline") : selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? colors.primary : colors.textFaint} />
      </Pressable>
      {!last ? <View style={{ height: 1, backgroundColor: "#F0F1F6", marginLeft: 16 }} /> : null}
    </>
  );
}

/** Date + time picker: native dialogs on Android, inline picker on iOS. */
export function DateTimeField({ label, value, onChange, minimumDate, maximumDate, dateOnly }: { label?: string; value: Date; onChange: (d: Date) => void; minimumDate?: Date; maximumDate?: Date; dateOnly?: boolean }) {
  const [iosOpen, setIosOpen] = useState(false);
  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value, mode: "date", minimumDate, maximumDate,
        onChange: (e, d) => {
          if (e.type !== "set" || !d) return;
          if (dateOnly) { onChange(d); return; }
          DateTimePickerAndroid.open({
            value: d, mode: "time",
            onChange: (e2, t) => { if (e2.type === "set" && t) { const out = new Date(d); out.setHours(t.getHours(), t.getMinutes(), 0, 0); onChange(out); } },
          });
        },
      });
    } else setIosOpen((o) => !o);
  };
  return (
    <View style={{ gap: 7 }}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <Pressable onPress={open} style={st.field}>
        <Ionicons name="calendar-outline" size={19} color={colors.textFaint} />
        <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{dateOnly ? value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : formatDateTime(value.toISOString())}</Text>
      </Pressable>
      {iosOpen && Platform.OS === "ios" ? (
        <DateTimePicker value={value} mode={dateOnly ? "date" : "datetime"} display="inline" minimumDate={minimumDate} maximumDate={maximumDate} onChange={(_, d) => d && onChange(d)} accentColor={colors.primary} />
      ) : null}
    </View>
  );
}

/** Round floating action button above the tab bar. */
export function Fab({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [st.fab, { bottom: Math.max(insets.bottom, 10) + 20 }, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Ionicons name={icon} size={26} color="#fff" />
    </Pressable>
  );
}

const st = StyleSheet.create({
  stackHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.page },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.card },
  group: { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", ...shadow.card },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15.5, fontWeight: "600", color: colors.text },
  rowValue: { fontSize: 14, color: colors.textMuted, maxWidth: 170 },
  backdrop: { flex: 1, backgroundColor: "rgba(10,13,42,0.45)" },
  sheet: { backgroundColor: colors.page, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10, maxHeight: "88%" },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#D5D8E6", marginBottom: 12 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E9EBF3", alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginLeft: 2 },
  field: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 14 },
  fab: { position: "absolute", right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadow.float },
});
