import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { Fab, StackHeader } from "@/components/kit";
import { Avatar, Badge, Chip, EmptyState, ErrorView, Loading, SearchBar } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { colors, shadow } from "@/lib/theme";
import type { Paged } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

type User = {
  id: number; full_name: string; email: string; mobile: string | null; status: string; avatar?: string | null;
  roles: string | null; websites: string | null; teams: string | null; department_name: string | null;
};

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: colors.successSoft, fg: colors.success },
  DISABLED: { bg: "#EEF0F5", fg: "#4A5070" },
  SUSPENDED: { bg: colors.warningSoft, fg: colors.warning },
  BLOCKED: { bg: colors.dangerSoft, fg: colors.danger },
  PENDING_APPROVAL: { bg: colors.warningSoft, fg: colors.warning },
};
const FILTERS = [["", "All"], ["ACTIVE", "Active"], ["DISABLED", "Disabled"], ["SUSPENDED", "Suspended"], ["BLOCKED", "Blocked"]] as const;

export default function TeamMembers() {
  const { can } = useAuth();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  useEffect(() => { const t = setTimeout(() => setSearch(text.trim()), 350); return () => clearTimeout(t); }, [text]);

  const q = useInfiniteQuery({
    queryKey: ["admin", "users", search, status],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Paged<User>>(`/admin/users?${new URLSearchParams({ page: String(pageParam), limit: "30", ...(search ? { search } : {}), ...(status ? { status } : {}) })}`),
    getNextPageParam: (l) => (l.meta.page * l.meta.limit < l.meta.total ? l.meta.page + 1 : undefined),
  });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <StackHeader title="Team members" subtitle={q.data ? `${q.data.pages[0]?.meta.total ?? 0} people` : undefined} />
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
        <SearchBar value={text} onChangeText={setText} placeholder="Search name, email or mobile" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(([k, l]) => <Chip key={k} label={l} active={status === k} onPress={() => setStatus(k)} />)}
        </ScrollView>
      </View>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <FlatList
          data={rows}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No team members found" />}
          renderItem={({ item: u }) => {
            const tone = STATUS_TONE[u.status] ?? STATUS_TONE.DISABLED!;
            return (
              <Pressable onPress={() => router.push(`/admin/user/${u.id}` as Href)} style={({ pressed }) => [st.card, pressed && { transform: [{ scale: 0.985 }] }]}>
                <Avatar name={u.full_name} src={u.avatar} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={st.name} numberOfLines={1}>{u.full_name}</Text>
                    <Badge label={titleCase(u.status)} bg={tone.bg} fg={tone.fg} />
                  </View>
                  <Text style={st.meta} numberOfLines={1}>{u.email}</Text>
                  <Text style={[st.meta, { fontSize: 12 }]} numberOfLines={1}>{[u.roles?.split(",").map(titleCase).join(", "), u.websites, u.department_name].filter(Boolean).join(" · ")}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
      {can("user.create") ? <Fab icon="person-add" label="New user" onPress={() => router.push("/admin/user/new" as Href)} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 20, padding: 14, ...shadow.card },
  name: { fontSize: 15.5, fontWeight: "700", color: colors.text, flexShrink: 1 },
  meta: { fontSize: 13, color: colors.textMuted },
});
