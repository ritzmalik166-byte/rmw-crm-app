import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Avatar, Badge, EmptyState, ErrorView, Header, Loading } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { colors, shadow } from "@/lib/theme";
import type { Followup, Paged } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

const STATUS = [
  { key: "today", label: "Today" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "COMPLETED", label: "Done" },
] as const;

const PRIORITY: Record<string, { bg: string; fg: string }> = {
  LOW: { bg: "#EEF0F5", fg: "#4A5070" }, MEDIUM: { bg: "#E8F0FE", fg: "#2563EB" },
  HIGH: { bg: "#FFF4DE", fg: "#B45309" }, URGENT: { bg: "#FDECEC", fg: "#B91C1C" },
};

const timeOf = (v: string) => new Date(v).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const dayOf = (v: string) => {
  const d = new Date(v);
  const t = new Date();
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(t.toDateString()).getTime()) / 864e5);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function Followups() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [status, setStatus] = useState<(typeof STATUS)[number]["key"]>("today");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const q = useQuery({
    queryKey: ["followups", status, scope],
    queryFn: () => api<Paged<Followup>>(`/crm/followups?status=${status}&scope=${scope}&limit=100`),
  });
  const complete = useMutation({
    mutationFn: (id: number) => api(`/crm/followups/${id}`, { method: "PATCH", body: { status: "COMPLETED" } }),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: ["followups"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => Alert.alert("Couldn't update", apiMessage(e)),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <Header
        title="Tasks"
        subtitle={q.data ? `${q.data.meta.total} ${STATUS.find((x) => x.key === status)!.label.toLowerCase()} follow-up${q.data.meta.total === 1 ? "" : "s"}` : " "}
        right={can("lead.view_all") ? (
          <Pressable onPress={() => setScope(scope === "mine" ? "all" : "mine")} style={st.scope}>
            <Ionicons name={scope === "mine" ? "person" : "people"} size={15} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{scope === "mine" ? "Mine" : "Team"}</Text>
          </Pressable>
        ) : undefined}
      />
      <View style={st.segment}>
        {STATUS.map((x) => {
          const active = status === x.key;
          return (
            <Pressable key={x.key} onPress={() => { void Haptics.selectionAsync(); setStatus(x.key); }} style={[st.seg, active && st.segActive]}>
              <Text style={{ fontWeight: "700", fontSize: 13.5, color: active ? (x.key === "OVERDUE" ? colors.danger : colors.navy) : colors.textMuted }}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <FlatList
          data={q.data!.rows}
          keyExtractor={(f) => String(f.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 10, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="checkmark-done-outline" title={status === "COMPLETED" ? "Nothing completed yet" : "You're all caught up"} text={status === "COMPLETED" ? undefined : "No follow-ups here. Enjoy the calm ☕"} />}
          renderItem={({ item: f }) => {
            const overdue = f.status === "OVERDUE";
            const done = f.status === "COMPLETED";
            const p = PRIORITY[f.priority] ?? PRIORITY.MEDIUM!;
            return (
              <Pressable onPress={() => router.push(`/lead/${f.lead_id}`)} style={({ pressed }) => [st.card, pressed && { transform: [{ scale: 0.985 }] }]}>
                <View style={[st.rail, { backgroundColor: overdue ? colors.danger : done ? colors.success : colors.primary }]} />
                <View style={st.when}>
                  <Text style={[st.whenTime, overdue && { color: colors.danger }]}>{timeOf(f.due_at)}</Text>
                  <Text style={st.whenDay}>{dayOf(f.due_at)}</Text>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Avatar name={f.lead_name} size={26} />
                    <Text style={[st.name, done && { textDecorationLine: "line-through", color: colors.textMuted }]} numberOfLines={1}>{f.lead_name || "Unnamed lead"}</Text>
                  </View>
                  {f.notes ? <Text style={st.notes} numberOfLines={2}>{f.notes}</Text> : null}
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Badge label={titleCase(f.priority)} bg={p.bg} fg={p.fg} />
                    {scope === "all" && f.owner ? <Text style={{ color: colors.textFaint, fontSize: 12 }}>· {f.owner}</Text> : null}
                  </View>
                </View>
                {!done ? (
                  <Pressable hitSlop={8} onPress={() => complete.mutate(f.id)} style={st.check} accessibilityLabel="Mark done">
                    {complete.isPending && complete.variables === f.id ? <Ionicons name="hourglass-outline" size={18} color={colors.textMuted} /> : <Ionicons name="checkmark" size={20} color={colors.success} />}
                  </Pressable>
                ) : <Ionicons name="checkmark-circle" size={26} color={colors.success} />}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  scope: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  segment: { flexDirection: "row", marginHorizontal: 16, backgroundColor: "#E9EBF3", borderRadius: 16, padding: 4 },
  seg: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 12 },
  segActive: { backgroundColor: "#fff", ...shadow.card },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", borderRadius: 20, padding: 14, paddingLeft: 18, overflow: "hidden", ...shadow.card },
  rail: { position: "absolute", left: 0, top: 14, bottom: 14, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  when: { width: 64, alignItems: "flex-start" },
  whenTime: { fontSize: 16, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  whenDay: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  name: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  notes: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  check: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: "#BFE8D6", alignItems: "center", justifyContent: "center", backgroundColor: colors.successSoft },
});
