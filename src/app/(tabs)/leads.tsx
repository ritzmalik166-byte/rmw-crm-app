import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { RangeBar, type Range } from "@/components/RangeBar";
import { LeadCard } from "@/components/LeadCard";
import { Chip, EmptyState, ErrorView, Header, Loading, SearchBar } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { colors } from "@/lib/theme";
import type { PipelineCounts, PipelineKey } from "@/lib/pipelines";
import type { LeadRow, Paged } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "All", params: {} },
  { key: "me", label: "My leads", params: { assignedUserId: "me" } },
  { key: "unassigned", label: "Unassigned", params: { assignedUserId: "unassigned" } },
  { key: "mpf", label: "MPF Leads", params: { pipeline: "mpf" } },
  { key: "rmw", label: "RMW Leads", params: { pipeline: "rmw" } },
  { key: "ct", label: "CT Leads", params: { pipeline: "ct" } },
  { key: "career", label: "Careers", params: { pipeline: "career" } },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

/** Remount when opened from a Home link with a new range/view, so the screen starts from those values. */
export default function Leads() {
  const p = useLocalSearchParams<{ from?: string; to?: string; preset?: Range["preset"]; view?: string }>();
  return <LeadsScreen key={`${p.from}|${p.to}|${p.view}`} initialRange={p.from && p.to ? { preset: p.preset ?? "custom", from: p.from, to: p.to } : null} initialFilter={(FILTERS.some((f) => f.key === p.view) ? p.view : "all") as FilterKey} />;
}

function LeadsScreen({ initialRange, initialFilter }: { initialRange: Range | null; initialFilter: FilterKey }) {
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [range, setRange] = useState<Range | null>(initialRange);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const params = FILTERS.find((f) => f.key === filter)!.params;
  const q = useInfiniteQuery({
    queryKey: ["leads", filter, search, range?.from, range?.to],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ page: String(pageParam), limit: "25", ...params, ...(search ? { search } : {}), ...(range ? { from: range.from, to: range.to } : {}), sort: "received_at", dir: "desc" });
      return api<Paged<LeadRow>>(`/crm/leads?${qs}`);
    },
    getNextPageParam: (last) => (last.meta.page * last.meta.limit < last.meta.total ? last.meta.page + 1 : undefined),
  });
  const pipes = useQuery({
    queryKey: ["pipelines", range?.from ?? "all", range?.to ?? "all"],
    queryFn: () => api<{ counts: Partial<Record<PipelineKey | "career", PipelineCounts>> }>(`/crm/pipelines${range ? `?from=${range.from}&to=${range.to}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const countFor = (k: string) => (k === "mpf" || k === "rmw" || k === "ct" || k === "career" ? pipes.data?.counts[k]?.total : undefined);
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const total = q.data?.pages[0]?.meta.total;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <Header title="Leads" subtitle={total !== undefined ? `${total.toLocaleString("en-IN")} in this view` : " "} />
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 10 }}>
        <SearchBar value={text} onChangeText={setText} placeholder="Search name, phone, email or ID" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} style={{ marginRight: -16 }}>
          {FILTERS.map((f) => <Chip key={f.key} label={f.label} count={countFor(f.key)} active={filter === f.key} onPress={() => setFilter(f.key)} />)}
        </ScrollView>
        <View style={{ marginRight: -16 }}><RangeBar value={range} onChange={setRange} allowAll /></View>
      </View>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <FlatList
          data={rows}
          keyExtractor={(l) => String(l.id)}
          renderItem={({ item }) => <LeadCard lead={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, gap: 10, paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No leads found" text={search ? "Try a different name, number or ID." : "Nothing matches this filter yet."} />}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} /> : undefined}
        />
      )}
    </View>
  );
}
