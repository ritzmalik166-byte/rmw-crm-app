import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState, ErrorView, Header, Loading, type IconName } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { colors, shadow } from "@/lib/theme";
import type { Notification, Paged } from "@/lib/types";

/** Notification links point at web routes like /crm/leads/123; open the matching app screen when there is one. */
function openLink(link: string | null) {
  const m = link?.match(/\/crm\/leads\/(\d+)/);
  if (m) router.push(`/lead/${m[1]}`);
  else if (link?.includes("followups")) router.push("/followups");
}

function iconFor(n: Notification): { icon: IconName; tone: string } {
  const t = `${n.title} ${n.body ?? ""}`.toLowerCase();
  if (t.includes("overdue")) return { icon: "alarm", tone: colors.danger };
  if (t.includes("follow")) return { icon: "calendar", tone: colors.violet };
  if (t.includes("assign")) return { icon: "person-add", tone: colors.blue };
  if (t.includes("new lead") || t.includes("lead")) return { icon: "sparkles", tone: colors.gold };
  return { icon: "notifications", tone: colors.primary };
}

export default function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications", "list"], queryFn: () => api<Paged<Notification> & { unread: number }>("/crm/notifications?limit=50") });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["notifications"] }); };
  const read = useMutation({ mutationFn: (id: number) => api(`/crm/notifications/${id}/read`, { method: "POST" }), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api("/crm/notifications/read-all", { method: "POST" }), onSuccess: refresh });

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <Header
        onBack={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
        title="Notifications"
        subtitle={q.data ? (q.data.unread ? `${q.data.unread} unread` : "All caught up") : " "}
        right={q.data?.unread ? (
          <Pressable onPress={() => readAll.mutate()} style={st.readAll}>
            <Ionicons name="checkmark-done" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Read all</Text>
          </Pressable>
        ) : undefined}
      />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <FlatList
          data={q.data!.rows}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, gap: 10, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="No alerts yet" text="New leads, assignments and due follow-ups will show up here." />}
          renderItem={({ item: n }) => {
            const ic = iconFor(n);
            const unread = !n.read_at;
            return (
              <Pressable onPress={() => { if (unread) read.mutate(n.id); openLink(n.link); }} style={({ pressed }) => [st.card, pressed && { transform: [{ scale: 0.985 }] }]}>
                <View style={[st.icon, { backgroundColor: `${ic.tone}1A` }]}><Ionicons name={ic.icon} size={19} color={ic.tone} /></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[st.title, !unread && { fontWeight: "600", color: colors.textMuted }]} numberOfLines={1}>{n.title}</Text>
                    <Text style={st.time}>{timeAgo(n.created_at)}</Text>
                  </View>
                  {n.body ? <Text style={st.body} numberOfLines={2}>{n.body}</Text> : null}
                </View>
                {unread ? <View style={st.dot} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  readAll: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", borderRadius: 20, padding: 14, ...shadow.card },
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  time: { fontSize: 12, color: colors.textFaint },
  body: { fontSize: 13.5, color: colors.textMuted, lineHeight: 19 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blue },
});
