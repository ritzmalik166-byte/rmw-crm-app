import { Ionicons } from "@expo/vector-icons";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { RangeBar, type Range } from "@/components/RangeBar";
import { LeadCard } from "@/components/LeadCard";
import { MetaFormRow, MetaLogo } from "@/components/Meta";
import { Sheet } from "@/components/kit";
import { Chip, EmptyState, ErrorView, Header, Loading, SearchBar } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { useMetaForms, type Channel } from "@/lib/meta";
import { colors, shadow } from "@/lib/theme";
import { PIPELINES, usePipelines, type PipelineCounts, type PipelineKey } from "@/lib/pipelines";
import { useAuth } from "@/providers/AuthProvider";
import type { LeadRow, Paged } from "@/lib/types";

const FILTERS = [
  { key: "all", label: "All", params: {} },
  { key: "me", label: "My leads", params: { assignedUserId: "me" } },
  { key: "unassigned", label: "Unassigned", params: { assignedUserId: "unassigned" } },
  { key: "mpf", label: "MPF Leads", params: { pipeline: "mpf" } },
  { key: "rmw", label: "RMW Leads", params: { pipeline: "rmw" } },
  { key: "ct", label: "CT Leads", params: { pipeline: "ct" } },
  { key: "ctmpl", label: "CTMPL Leads", params: { pipeline: "ctmpl" } },
  { key: "career", label: "Careers", params: { pipeline: "career" } },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];
type Counts = { counts: Partial<Record<PipelineKey | "career", PipelineCounts>> };

/** Remount when opened from a Home link with a new range/view, so the screen starts from those values. */
export default function Leads() {
  const p = useLocalSearchParams<{ from?: string; to?: string; preset?: Range["preset"]; view?: string; channel?: string; formId?: string }>();
  const channel = p.channel === "meta" || p.channel === "website" ? p.channel : null;
  return (
    <LeadsScreen
      key={`${p.from}|${p.to}|${p.view}|${p.channel}|${p.formId}`}
      initialRange={p.from && p.to ? { preset: p.preset ?? "custom", from: p.from, to: p.to } : null}
      initialFilter={(FILTERS.some((f) => f.key === p.view) ? p.view : "all") as FilterKey}
      initialChannel={channel}
      initialFormId={p.formId || null}
    />
  );
}

/** MPF only: Website / App vs Meta boxes, side by side. */
function ChannelBoxes({ channel, onChange, range }: { channel: Channel | null; onChange: (c: Channel | null) => void; range: Range | null }) {
  const rq = range ? `&from=${range.from}&to=${range.to}` : "";
  const web = useQuery({ queryKey: ["pipelines", "website", range?.from, range?.to], queryFn: () => api<Counts>(`/crm/pipelines?channel=website${rq}`), placeholderData: keepPreviousData });
  const meta = useQuery({ queryKey: ["pipelines", "meta", range?.from, range?.to], queryFn: () => api<Counts>(`/crm/pipelines?channel=meta${rq}`), placeholderData: keepPreviousData });
  const box = (key: Channel, title: string, icon: ReactNode, c?: PipelineCounts) => {
    const active = channel === key;
    return (
      <Pressable key={key} onPress={() => { void Haptics.selectionAsync(); onChange(active ? null : key); }} style={({ pressed }) => [st.box, active && st.boxActive, pressed && { opacity: 0.85 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {icon}
          <Text style={[st.boxTitle, active && { color: colors.primary }]} numberOfLines={2}>{title}</Text>
          {active ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={{ marginLeft: "auto" }} /> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View><Text style={st.boxNum}>{c?.total ?? "—"}</Text><Text style={st.boxLbl}>Total</Text></View>
          <View><Text style={[st.boxNum, { color: colors.blue }]}>{c?.new_leads ?? "—"}</Text><Text style={st.boxLbl}>New</Text></View>
          <View><Text style={[st.boxNum, !!c?.unassigned && { color: colors.warning }]}>{c?.unassigned ?? "—"}</Text><Text style={st.boxLbl}>Unassigned</Text></View>
        </View>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {box("website", "Website / App", <View style={st.webIcon}><Ionicons name="globe-outline" size={18} color="#0F766E" /></View>, web.data?.counts.mpf)}
      {box("meta", "Meta Leads", <MetaLogo size={34} />, meta.data?.counts.mpf)}
    </View>
  );
}

function LeadsScreen({ initialRange, initialFilter, initialChannel, initialFormId }: { initialRange: Range | null; initialFilter: FilterKey; initialChannel: Channel | null; initialFormId: string | null }) {
  const [filter, setFilter] = useState<FilterKey>(initialChannel || initialFormId ? "mpf" : initialFilter);
  const [channel, setChannel] = useState<Channel | null>(initialFormId ? "meta" : initialChannel);
  const [formId, setFormId] = useState<string | null>(initialFormId);
  const [formsOpen, setFormsOpen] = useState(false);
  const [junkOnly, setJunkOnly] = useState(false); // Meta: show junk & test leads instead of genuine ones
  const [range, setRange] = useState<Range | null>(initialRange);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const { can } = useAuth();
  const canMeta = can("lead.channel.meta");
  const allowed = usePipelines();
  // Pipeline chips only for websites this user can access.
  const filters = FILTERS.filter((f) => !PIPELINES.some((p) => p.key === f.key) || allowed.some((p) => p.key === f.key));
  const isMpf = filter === "mpf";
  const forms = useMetaForms(null, canMeta);
  const form = formId ? forms.data?.find((f) => f.formId === formId) : null;
  const params: Record<string, string> = {
    ...FILTERS.find((f) => f.key === filter)!.params,
    ...(isMpf && channel && (channel !== "meta" || canMeta) ? { channel } : {}),
    ...(isMpf && channel === "meta" && formId ? { formId } : {}),
    ...(isMpf && channel === "meta" && junkOnly ? { junk: "only" } : {}),
  };
  const q = useInfiniteQuery({
    queryKey: ["leads", filter, channel, formId, junkOnly, search, range?.from, range?.to],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ page: String(pageParam), limit: "25", ...params, ...(search ? { search } : {}), ...(range ? { from: range.from, to: range.to } : {}), sort: "received_at", dir: "desc" });
      return api<Paged<LeadRow>>(`/crm/leads?${qs}`);
    },
    getNextPageParam: (last) => (last.meta.page * last.meta.limit < last.meta.total ? last.meta.page + 1 : undefined),
  });
  const pipes = useQuery({
    queryKey: ["pipelines", range?.from ?? "all", range?.to ?? "all"],
    queryFn: () => api<Counts>(`/crm/pipelines${range ? `?from=${range.from}&to=${range.to}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const countFor = (k: string) => (k === "career" || PIPELINES.some((p) => p.key === k) ? pipes.data?.counts[k as PipelineKey | "career"]?.total : undefined);
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const total = q.data?.pages[0]?.meta.total;
  const pickFilter = (k: FilterKey) => { setFilter(k); if (k !== "mpf") { setChannel(null); setFormId(null); } };
  const pickChannel = (c: Channel | null) => { setChannel(c); if (c !== "meta") { setFormId(null); setJunkOnly(false); } };
  const junkCount = useQuery({
    queryKey: ["leads", "meta-junk-count"],
    queryFn: () => api<Paged<LeadRow>>("/crm/leads?pipeline=mpf&channel=meta&junk=only&limit=1").then((r) => r.meta.total),
    enabled: canMeta && isMpf && channel === "meta",
    staleTime: 60_000,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <Header title="Leads" subtitle={total !== undefined ? `${total.toLocaleString("en-IN")} in this view` : " "} />
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 10 }}>
        <SearchBar value={text} onChangeText={setText} placeholder="Search name, phone, email or ID" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} style={{ marginRight: -16 }}>
          {filters.map((f) => <Chip key={f.key} label={f.label} count={countFor(f.key)} active={filter === f.key} onPress={() => pickFilter(f.key)} />)}
        </ScrollView>
        {isMpf && canMeta ? <ChannelBoxes channel={channel} onChange={pickChannel} range={range} /> : null}
        {isMpf && canMeta && channel === "meta" ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Genuine leads" icon="checkmark-circle-outline" active={!junkOnly} onPress={() => setJunkOnly(false)} />
            <Chip label="Junk & test" icon="alert-circle-outline" count={junkCount.data} active={junkOnly} onPress={() => setJunkOnly(true)} />
          </View>
        ) : null}
        {isMpf && canMeta && channel === "meta" ? (
          <Pressable onPress={() => setFormsOpen(true)} style={st.formBtn}>
            <Ionicons name="document-text-outline" size={17} color="#0082FB" />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.text }} numberOfLines={1}>{form ? form.name : `All lead forms${forms.data?.length ? ` (${forms.data.length})` : ""}`}</Text>
            {formId ? <Ionicons name="close-circle" size={18} color={colors.textFaint} onPress={() => setFormId(null)} /> : <Ionicons name="chevron-down" size={17} color={colors.textMuted} />}
          </Pressable>
        ) : null}
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
      <Sheet open={formsOpen} onClose={() => setFormsOpen(false)} title="Meta lead forms">
        {forms.isLoading ? <Loading /> : !forms.data?.length ? <EmptyState icon="document-text-outline" title="No lead forms yet" text="Forms appear once Meta is connected." /> : (
          <View style={{ backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
            <Pressable onPress={() => { setFormId(null); setFormsOpen(false); }} style={[st.allForms, !formId && { backgroundColor: colors.primarySoft }]}>
              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: colors.text }}>All lead forms</Text>
              {!formId ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
            </Pressable>
            {forms.data.map((f) => <MetaFormRow key={f.formId} form={f} active={f.formId === formId} onPress={() => { setFormId(f.formId); setFormsOpen(false); }} />)}
          </View>
        )}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  box: { flex: 1, backgroundColor: "#fff", borderRadius: 18, padding: 12, gap: 10, borderWidth: 1.5, borderColor: "transparent", ...shadow.card },
  boxActive: { borderColor: colors.primary, backgroundColor: "#FBFAFF" },
  boxTitle: { flexShrink: 1, fontSize: 14.5, fontWeight: "800", color: colors.text },
  boxNum: { fontSize: 16, fontWeight: "800", color: colors.text },
  boxLbl: { fontSize: 11, color: colors.textMuted },
  webIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#E6F7F4", alignItems: "center", justifyContent: "center" },
  formBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
  allForms: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
});
