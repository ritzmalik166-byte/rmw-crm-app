import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { StackHeader } from "@/components/kit";
import { Avatar, Button, EmptyState, ErrorView, Loading, SearchBar } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { confirm, useAction } from "@/lib/hooks";
import { colors, shadow } from "@/lib/theme";
import type { Paged } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

type S = { id: number; user_id: number; full_name: string; email: string; ip_address: string | null; device_name: string | null; browser: string | null; operating_system: string | null; last_activity_at: string };

export default function AllSessions() {
  const { can, me } = useAuth();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setSearch(text.trim()), 350); return () => clearTimeout(t); }, [text]);
  const q = useInfiniteQuery({
    queryKey: ["admin", "sessions", search],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Paged<S>>(`/super-admin/sessions?page=${pageParam}&limit=40${search ? `&search=${encodeURIComponent(search)}` : ""}`),
    getNextPageParam: (l) => (l.meta.page * l.meta.limit < l.meta.total ? l.meta.page + 1 : undefined),
  });
  const end = useAction((id: number) => api(`/super-admin/sessions/${id}`, { method: "DELETE" }), { invalidate: [["admin", "sessions"]] });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <StackHeader title="Active sessions" subtitle={q.data ? `${q.data.pages[0]?.meta.total ?? 0} signed in` : undefined} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><SearchBar value={text} onChangeText={setText} placeholder="Search name, email or IP" /></View>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <FlatList
          data={rows}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="phone-portrait-outline" title="No active sessions" />}
          renderItem={({ item: s }) => (
            <View style={st.card}>
              <Avatar name={s.full_name} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.name} numberOfLines={1}>{s.full_name}</Text>
                <Text style={st.meta} numberOfLines={1}>{s.device_name || [s.browser, s.operating_system].filter(Boolean).join(" · ") || "Unknown device"}</Text>
                <Text style={st.meta}>{[s.ip_address, `active ${timeAgo(s.last_activity_at)}`].filter(Boolean).join(" · ")}</Text>
              </View>
              {can("session.revoke_any") && s.user_id !== me?.user.id ? (
                <Button title="End" size="sm" variant="outline" loading={end.isPending && end.variables === s.id} onPress={() => confirm("End this session?", `${s.full_name} will be signed out on this device.`, "End session", () => end.mutate(s.id))} />
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 20, padding: 14, ...shadow.card },
  name: { fontSize: 15, fontWeight: "700", color: colors.text },
  meta: { fontSize: 12.5, color: colors.textMuted },
});
