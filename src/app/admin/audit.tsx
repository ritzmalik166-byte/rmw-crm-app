import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { StackHeader } from "@/components/kit";
import { RangeBar, type Range } from "@/components/RangeBar";
import { EmptyState, ErrorView, Loading } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { formatDateTime, timeAgo, titleCase } from "@/lib/format";
import { colors, shadow } from "@/lib/theme";
import type { Paged } from "@/lib/types";

type Log = { id: number; action: string; entity_type: string | null; entity_id: string | null; actor_name: string | null; actor_email: string | null; ip_address: string | null; meta: unknown; created_at: string };

export default function AuditLog() {
  const [range, setRange] = useState<Range | null>(null);
  const q = useInfiniteQuery({
    queryKey: ["admin", "audit", range?.from, range?.to],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Paged<Log>>(`/admin/audit-logs?page=${pageParam}&limit=50${range ? `&from=${range.from}&to=${range.to}` : ""}`),
    getNextPageParam: (l) => (l.meta.page * l.meta.limit < l.meta.total ? l.meta.page + 1 : undefined),
  });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const show = (l: Log) => {
    let meta = "";
    try { meta = JSON.stringify(typeof l.meta === "string" ? JSON.parse(l.meta) : l.meta, null, 2); } catch { meta = String(l.meta ?? ""); }
    Alert.alert(titleCase(l.action), [`${l.actor_name || "System"}${l.actor_email ? ` (${l.actor_email})` : ""}`, formatDateTime(l.created_at), l.entity_type ? `${l.entity_type} #${l.entity_id}` : "", l.ip_address ? `IP ${l.ip_address}` : "", meta && meta !== "null" ? `\n${meta}` : ""].filter(Boolean).join("\n"));
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <StackHeader title="Audit log" subtitle={q.data ? `${q.data.pages[0]?.meta.total ?? 0} entries` : undefined} />
      <View style={{ paddingLeft: 16, paddingBottom: 8 }}><RangeBar value={range} onChange={setRange} allowAll /></View>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <FlatList
          data={rows}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="document-text-outline" title="No entries" />}
          renderItem={({ item: l }) => (
            <Pressable onPress={() => show(l)} style={st.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={st.action} numberOfLines={1}>{titleCase(l.action)}</Text>
                <Text style={st.meta}>{timeAgo(l.created_at)}</Text>
              </View>
              <Text style={st.meta} numberOfLines={1}>{l.actor_name || "System"}{l.entity_type ? ` · ${l.entity_type} #${l.entity_id}` : ""}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 12, gap: 3, ...shadow.card },
  action: { flex: 1, fontSize: 14.5, fontWeight: "700", color: colors.text },
  meta: { fontSize: 12.5, color: colors.textMuted },
});
