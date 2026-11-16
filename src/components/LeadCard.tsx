import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, StatusBadge } from "@/components/ui";
import { timeAgo, whatsappUrl } from "@/lib/format";
import { pipelineFor } from "@/lib/pipelines";
import { colors, shadow } from "@/lib/theme";
import type { LeadRow } from "@/lib/types";
import { LEAD_SOURCE_TYPES } from "@/lib/meta";
import { MetaLogo } from "@/components/Meta";

type Lead = Pick<LeadRow, "id" | "name" | "interest" | "website_code" | "status_name" | "status_color" | "created_at"> & Partial<LeadRow>;

export function LeadCard({ lead }: { lead: Lead }) {
  const pipe = pipelineFor(lead.website_code);
  const wa = whatsappUrl(lead.phone);
  const isMeta = lead.source_type === LEAD_SOURCE_TYPES.META;
  const source = isMeta
    ? [`Meta – ${lead.source === "instagram" ? "Instagram" : "Facebook"}`, lead.campaign].filter(Boolean).join(" · ")
    : [pipe ? `Website – ${pipe.short}` : lead.website_code, lead.form_type].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={() => router.push(`/lead/${lead.id}`)} style={({ pressed }) => [st.card, pressed && { transform: [{ scale: 0.985 }] }]}>
      <Avatar name={lead.name} size={46} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={st.name} numberOfLines={1}>{lead.name || "Unnamed lead"}</Text>
          {isMeta ? <MetaLogo size={20} badge={false} /> : null}
          <StatusBadge name={lead.status_name} color={lead.status_color} />
          <Text style={st.time}>{timeAgo(lead.external_created_at || lead.created_at)}</Text>
        </View>
        <Text style={st.phone} numberOfLines={1}>{lead.phone || lead.email || "No contact details"}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.meta} numberOfLines={1}>Source: {source || "—"}</Text>
            <Text style={[st.meta, lead.assigned_user_id === null && { color: colors.warning, fontWeight: "600" }]} numberOfLines={1}>
              {lead.assigned_user_id === null ? "● Unassigned" : lead.interest || lead.assigned_user_name || ""}
            </Text>
          </View>
          {lead.phone ? (
            <Pressable hitSlop={4} onPress={() => void Linking.openURL(`tel:${lead.phone}`)} style={[st.act, { backgroundColor: colors.successSoft }]} accessibilityLabel="Call lead">
              <Ionicons name="call" size={16} color={colors.success} />
            </Pressable>
          ) : null}
          {wa ? (
            <Pressable hitSlop={4} onPress={() => void Linking.openURL(wa)} style={[st.act, { backgroundColor: colors.successSoft }]} accessibilityLabel="WhatsApp lead">
              <Ionicons name="logo-whatsapp" size={17} color={colors.whatsapp} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#fff", borderRadius: 20, padding: 14, ...shadow.card },
  name: { flexShrink: 1, fontSize: 16, fontWeight: "700", color: colors.text, letterSpacing: -0.2 },
  time: { marginLeft: "auto", fontSize: 11.5, color: colors.textFaint },
  phone: { fontSize: 13.5, color: colors.text, fontWeight: "500" },
  meta: { fontSize: 12.5, color: colors.textMuted },
  act: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
