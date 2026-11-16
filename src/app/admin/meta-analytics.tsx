import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SelectField, StackHeader } from "@/components/kit";
import { RangeBar, rangeLabel, ymd, type Range } from "@/components/RangeBar";
import { Button, ErrorView, Loading, Screen } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { useLookups } from "@/lib/hooks";
import { fmtMoney, fmtNum } from "@/lib/meta";
import { colors, shadow } from "@/lib/theme";

type Opt = { id: string; name: string | null };
type Analytics = {
  totals: { total: number; newLeads: number; qualified: number; siteVisits: number; converted: number; conversionRate: number; spend: number | null; cpl: number | null; currency: string | null; excludedJunk: number };
  funnel: { key: string; label: string; count: number; pctOfTotal: number; pctOfPrevious: number }[];
  campaigns: { campaignId: string | null; campaignName: string; leads: number; qualified: number; siteVisits: number; converted: number; spend: number | null; cpl: number | null; currency: string | null }[];
  byDay: { day: string; total: number }[];
  spendAvailable: boolean;
  options: { campaigns: Opt[]; adSets: (Opt & { campaign_id: string })[]; ads: (Opt & { ad_set_id: string })[]; forms: Opt[]; users: { id: number; name: string }[] };
};

const last30 = (): Range => { const d = new Date(); const f = new Date(); f.setDate(f.getDate() - 29); return { preset: "30d", from: ymd(f), to: ymd(d) }; };
const EMPTY = { campaignId: "", adSetId: "", formId: "", platform: "", assignedUserId: "", statusId: "" };
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <View style={st.tile}>
      <Text style={st.tileL}>{label}</Text>
      <Text style={[st.tileV, tone ? { color: tone } : null]}>{value}</Text>
      {hint ? <Text style={st.hint} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

/** Meta Ads performance from CRM data: KPIs, funnel, leads per day and campaign table (same API as the web). */
export default function MetaAnalytics() {
  const [range, setRange] = useState<Range>(last30);
  const [f, setF] = useState(EMPTY);
  const lk = useLookups();
  const qs = new URLSearchParams(Object.entries({ from: range.from, to: range.to, ...f }).filter(([, v]) => v)).toString();
  const q = useQuery({ queryKey: ["admin", "meta-analytics", qs], queryFn: () => api<Analytics>(`/admin/marketing/meta/analytics?${qs}`), placeholderData: keepPreviousData });
  const d = q.data;
  const o = d?.options;
  const adSets = useMemo(() => (o?.adSets ?? []).filter((a) => !f.campaignId || a.campaign_id === f.campaignId), [o, f.campaignId]);
  const active = Object.values(f).filter(Boolean).length;
  const max = Math.max(1, ...(d?.byDay ?? []).map((x) => x.total));
  const t = d?.totals;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <StackHeader title="Meta Ads" subtitle={rangeLabel(range)} />
      <View style={{ paddingLeft: 16, paddingBottom: 8 }}><RangeBar value={range} onChange={(r) => r && setRange(r)} /></View>
      <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        <View style={st.filters}>
          <View style={st.half}><SelectField value={f.campaignId} onChange={(v) => setF({ ...f, campaignId: v, adSetId: "" })} options={[{ value: "", label: "All campaigns" }, ...(o?.campaigns ?? []).map((c) => ({ value: c.id, label: c.name || c.id }))]} /></View>
          <View style={st.half}><SelectField value={f.adSetId} onChange={(v) => setF({ ...f, adSetId: v })} options={[{ value: "", label: "All ad sets" }, ...adSets.map((c) => ({ value: c.id, label: c.name || c.id }))]} /></View>
          <View style={st.half}><SelectField value={f.formId} onChange={(v) => setF({ ...f, formId: v })} options={[{ value: "", label: "All forms" }, ...(o?.forms ?? []).map((c) => ({ value: c.id, label: c.name || c.id }))]} /></View>
          <View style={st.half}><SelectField value={f.platform} onChange={(v) => setF({ ...f, platform: v })} options={[{ value: "", label: "FB + Instagram" }, { value: "facebook", label: "Facebook" }, { value: "instagram", label: "Instagram" }]} /></View>
          <View style={st.half}><SelectField value={f.assignedUserId} onChange={(v) => setF({ ...f, assignedUserId: v })} options={[{ value: "", label: "All salespeople" }, { value: "unassigned", label: "Unassigned" }, ...(o?.users ?? []).map((u) => ({ value: String(u.id), label: u.name }))]} /></View>
          <View style={st.half}><SelectField value={f.statusId} onChange={(v) => setF({ ...f, statusId: v })} options={[{ value: "", label: "Any status" }, ...(lk.data?.statuses ?? []).map((s) => ({ value: String(s.id), label: s.name }))]} /></View>
        </View>
        {active ? <Button title={`Clear filters (${active})`} icon="close" size="sm" variant="ghost" onPress={() => setF(EMPTY)} /> : null}

        {q.isLoading ? <Loading /> : q.isError || !d || !t ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
          <View style={{ gap: 14, opacity: q.isFetching ? 0.7 : 1 }}>
            <View style={st.grid}>
              <Tile label="Total leads" value={fmtNum(t.total)} hint={t.excludedJunk ? `${fmtNum(t.excludedJunk)} junk excluded` : undefined} />
              <Tile label="New" value={fmtNum(t.newLeads)} hint="Not yet worked" tone={colors.primary} />
              <Tile label="Qualified" value={fmtNum(t.qualified)} />
              <Tile label="Site visits" value={fmtNum(t.siteVisits)} />
              <Tile label="Converted" value={fmtNum(t.converted)} hint={`${t.conversionRate}% of leads`} tone={colors.success} />
              <Tile label="Cost per lead" value={fmtMoney(t.cpl, t.currency)} hint={t.spend != null ? `${fmtMoney(t.spend, t.currency)} spend` : "Select an ad account"} />
            </View>

            <View style={st.card}>
              <Text style={st.title}>Lead funnel</Text>
              {!d.funnel[0]?.count ? <Text style={st.hint}>No Meta leads in this period.</Text> : d.funnel.map((s, i) => (
                <View key={s.key} style={{ gap: 2 }}>
                  {i > 0 ? <Text style={st.hint}>↓ {s.pctOfPrevious}% of {d.funnel[i - 1]!.label.toLowerCase()}</Text> : null}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ width: 86, fontSize: 12.5, color: colors.textMuted }} numberOfLines={1}>{s.label}</Text>
                    <View style={st.track}>
                      <View style={[st.fill, { width: `${Math.max(s.pctOfTotal, s.count ? 8 : 0)}%`, opacity: 1 - i * 0.1 }]}>
                        <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "700" }}>{s.count ? fmtNum(s.count) : ""}</Text>
                      </View>
                    </View>
                    <Text style={{ width: 40, textAlign: "right", fontSize: 12, color: colors.textMuted }}>{s.pctOfTotal}%</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={st.card}>
              <Text style={st.title}>Meta leads per day</Text>
              {!d.byDay.length ? <Text style={st.hint}>No Meta leads in this period.</Text> : (
                <>
                  <View style={st.chart}>
                    {d.byDay.map((x) => (
                      <View key={x.day} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                        <View style={{ width: "70%", minWidth: 3, height: `${(x.total / max) * 100}%`, backgroundColor: "#1877F2", borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={st.hint}>{d.byDay[0]!.day.slice(5)}</Text>
                    <Text style={st.hint}>peak {max}/day</Text>
                    <Text style={st.hint}>{d.byDay[d.byDay.length - 1]!.day.slice(5)}</Text>
                  </View>
                </>
              )}
            </View>

            <View style={[st.card, { gap: 0 }]}>
              <Text style={[st.title, { marginBottom: 6 }]}>Campaign performance</Text>
              {!d.campaigns.length ? <Text style={st.hint}>No campaigns in this period.</Text> : d.campaigns.map((r) => {
                const on = !!f.campaignId && f.campaignId === r.campaignId;
                return (
                  <Pressable key={r.campaignId ?? "none"} disabled={!r.campaignId} onPress={() => setF({ ...f, campaignId: on ? "" : r.campaignId!, adSetId: "" })}
                    style={[st.camp, on && { backgroundColor: colors.primarySoft }]}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }} numberOfLines={2}>{r.campaignName}</Text>
                    <View style={st.campRow}>
                      <Text style={st.cell}><Text style={st.cellB}>{fmtNum(r.leads)}</Text> leads</Text>
                      <Text style={st.cell}><Text style={st.cellB}>{fmtNum(r.qualified)}</Text> qual. {pct(r.qualified, r.leads)}</Text>
                      <Text style={st.cell}><Text style={st.cellB}>{fmtNum(r.converted)}</Text> won {pct(r.converted, r.leads)}</Text>
                    </View>
                    <View style={st.campRow}>
                      <Text style={st.cell}>Visits <Text style={st.cellB}>{fmtNum(r.siteVisits)}</Text></Text>
                      <Text style={st.cell}>Spend <Text style={st.cellB}>{fmtMoney(r.spend, r.currency)}</Text></Text>
                      <Text style={st.cell}>CPL <Text style={st.cellB}>{fmtMoney(r.cpl, r.currency)}</Text></Text>
                    </View>
                  </Pressable>
                );
              })}
              {!d.spendAvailable && d.campaigns.length ? <Text style={[st.hint, { marginTop: 8 }]}>Spend and CPL appear after a sync with an ad account selected.</Text> : null}
            </View>
            <Button title="Meta connection" icon="settings-outline" variant="outline" onPress={() => router.push("/admin/meta")} />
          </View>
        )}
      </Screen>
    </View>
  );
}

const st = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  half: { width: "48.5%" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "48%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 18, padding: 14, gap: 2, ...shadow.card },
  tileL: { fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  tileV: { fontSize: 22, fontWeight: "800", color: colors.text },
  hint: { fontSize: 11.5, color: colors.textFaint },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 14, gap: 8, ...shadow.card },
  title: { fontSize: 15, fontWeight: "800", color: colors.text },
  track: { flex: 1, height: 26, backgroundColor: "#F0F2F7", borderRadius: 8, overflow: "hidden" },
  fill: { height: 26, borderRadius: 8, backgroundColor: colors.primary, justifyContent: "center", paddingHorizontal: 6 },
  chart: { height: 140, flexDirection: "row", alignItems: "flex-end", gap: 1 },
  camp: { paddingVertical: 10, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: "#F0F1F6", borderRadius: 10, gap: 4 },
  campRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  cell: { flex: 1, fontSize: 12, color: colors.textMuted },
  cellB: { fontWeight: "800", color: colors.text },
});
