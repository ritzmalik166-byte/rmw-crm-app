import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { timeAgo, titleCase } from "@/lib/format";
import { parseJson, type MetaForm } from "@/lib/meta";
import { colors, shadow } from "@/lib/theme";
import type { LeadDetail } from "@/lib/types";

/** Meta ∞ mark with an Instagram badge (Facebook + Instagram lead ads). */
export function MetaLogo({ size = 40, badge = true }: { size?: number; badge?: boolean }) {
  return (
    <View style={[st.logo, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Ionicons name="infinite" size={size * 0.62} color="#0082FB" />
      {badge ? (
        <LinearGradient
          colors={["#FEDA75", "#FA7E1E", "#D62976", "#962FBF", "#4F5BD5"]}
          start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
          style={[st.badge, { width: size * 0.46, height: size * 0.46, borderRadius: size * 0.15 }]}
        >
          <Ionicons name="logo-instagram" size={size * 0.3} color="#fff" />
        </LinearGradient>
      ) : null}
    </View>
  );
}

const STANDARD = new Set(["full_name", "first_name", "last_name", "email", "work_email", "phone_number", "work_phone_number"]);

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={[st.rowValue, !value && { color: colors.textFaint }]} selectable>{value || "—"}</Text>
    </View>
  );
}

function IdRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Pressable disabled={!value} onPress={() => { void Clipboard.setStringAsync(String(value)); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} style={st.idRow}>
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={st.idValue} numberOfLines={1}>{value || "—"}</Text>
      {value ? <Ionicons name="copy-outline" size={13} color={colors.textFaint} /> : null}
    </Pressable>
  );
}

/** Lead detail: Meta form answers + campaign for the salesperson; Meta IDs folded under "Technical details". */
export function MetaSourceCard({ lead }: { lead: LeadDetail }) {
  const [open, setOpen] = useState(false);
  const meta = parseJson<{ formResponses?: Record<string, string>; responseOrder?: { key: string; label: string }[]; platform?: string; isOrganic?: boolean }>(lead.external_metadata, {});
  const answers = meta.formResponses ?? {};
  const order = meta.responseOrder?.length ? meta.responseOrder : Object.keys(answers).map((key) => ({ key, label: titleCase(key) }));
  const custom = order.filter((q) => !STANDARD.has(q.key) && answers[q.key]);
  const platform = meta.platform === "instagram" ? "Instagram" : "Facebook";
  return (
    <View style={st.panel}>
      <View style={st.head}>
        <MetaLogo size={38} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>Meta Ads · {platform}</Text>
          <Text style={{ fontSize: 12.5, color: colors.textMuted }}>{meta.isOrganic ? "Organic lead form" : "Lead form from a paid ad"}</Text>
        </View>
      </View>
      {custom.length ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={st.label}>Form answers</Text>
          {custom.map((q) => <Row key={q.key} label={q.label} value={answers[q.key]} />)}
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 16 }}>
        <Row label="Campaign" value={lead.campaign_name} />
        <Row label="Ad set" value={lead.ad_set_name} />
        <Row label="Ad" value={lead.ad_name} />
        <Row label="Form" value={lead.form_name} />
      </View>
      <Pressable onPress={() => setOpen((v) => !v)} style={st.tech}>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: colors.textMuted }}>Technical details</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
          <IdRow label="Lead ID" value={lead.source_lead_id} />
          <IdRow label="Campaign ID" value={lead.campaign_id} />
          <IdRow label="Ad set ID" value={lead.ad_set_id} />
          <IdRow label="Ad ID" value={lead.ad_id} />
          <IdRow label="Form ID" value={lead.form_id} />
          <IdRow label="Page ID" value={lead.page_id} />
        </View>
      ) : null}
    </View>
  );
}

/** One Meta lead form row (Home section, forms sheet). */
export function MetaFormRow({ form, onPress, active }: { form: MetaForm; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.formRow, active && { backgroundColor: colors.primarySoft }, pressed && { backgroundColor: "#F8F6FE" }]}>
      <View style={st.formIcon}><Ionicons name="document-text" size={16} color="#0082FB" /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "700", color: colors.text }} numberOfLines={1}>{form.name}</Text>
        <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
          {form.lastLeadAt ? `Last lead ${timeAgo(form.lastLeadAt)}` : "No leads yet"}{form.newLeads ? ` · ${form.newLeads} new` : ""}{form.unassigned ? ` · ${form.unassigned} unassigned` : ""}
        </Text>
      </View>
      {form.inRange != null ? <Text style={{ fontSize: 12.5, color: colors.textMuted }}>+{form.inRange}</Text> : null}
      <Text style={{ minWidth: 34, textAlign: "right", fontSize: 16, fontWeight: "800", color: colors.text }}>{form.total}</Text>
      {active ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  logo: { backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  badge: { position: "absolute", right: -4, bottom: -4, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  panel: { backgroundColor: "#fff", borderRadius: 22, ...shadow.card, gap: 10, paddingBottom: 6, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#EEF6FF" },
  label: { fontSize: 12, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F1FA" },
  rowLabel: { width: 110, fontSize: 13.5, color: colors.textMuted },
  rowValue: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "600" },
  tech: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F3F1FA" },
  idRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 },
  idValue: { flex: 1, fontSize: 12.5, color: colors.text, fontFamily: "monospace" },
  formRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  formIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#EAF4FF", alignItems: "center", justifyContent: "center" },
});
