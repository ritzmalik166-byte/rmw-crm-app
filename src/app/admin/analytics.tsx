import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StackHeader } from "@/components/kit";
import { RangeBar, rangeLabel, type Range } from "@/components/RangeBar";
import { Card, ErrorView, Loading, Screen } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { colors, shadow, statusTone } from "@/lib/theme";

type Overview = {
  totals: { total: number; converted: number; unassigned: number; newLeads: number; conversionRate: number };
  byWebsite: { code: string; name: string; total: number; converted: number }[];
  byStatus: { code: string; name: string; color: string; total: number }[];
  bySource: { source: string; medium: string; total: number; converted: number }[];
  byCampaign: { campaign: string; total: number; converted: number }[];
  byUser: { id: number; full_name: string; total: number; converted: number; open_leads: number }[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const last30 = (): Range => { const d = new Date(); const f = new Date(); f.setDate(f.getDate() - 29); return { preset: "30d", from: ymd(f), to: ymd(d) }; };

/** Horizontal bar list: label, value, share of the max. */
function Bars({ rows, color = colors.primary }: { rows: { label: string; value: number; sub?: string; color?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <Text style={{ color: colors.textMuted }}>No data in this period.</Text>;
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 5 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.text }} numberOfLines={1}>{r.label}</Text>
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{r.value}</Text>
          </View>
          <View style={st.track}><View style={[st.fill, { width: `${(r.value / max) * 100}%`, backgroundColor: r.color ?? color }]} /></View>
          {r.sub ? <Text style={{ fontSize: 12, color: colors.textMuted }}>{r.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export default function Analytics() {
  const [range, setRange] = useState<Range>(last30);
  const q = useQuery({
    queryKey: ["admin", "analytics", range.from, range.to],
    queryFn: () => api<Overview>(`/admin/analytics?from=${range.from}&to=${range.to}`),
    placeholderData: keepPreviousData,
  });
  const d = q.data;
  const pct = (c: number, t: number) => (t ? `${((c / t) * 100).toFixed(1)}% converted` : "");

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Analytics" subtitle={rangeLabel(range)} />
      <View style={{ paddingLeft: 16, paddingBottom: 8 }}><RangeBar value={range} onChange={(r) => r && setRange(r)} /></View>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
          <View style={st.grid}>
            {[
              ["Leads", d!.totals.total, colors.blue],
              ["Converted", d!.totals.converted, colors.success],
              ["Conversion", `${d!.totals.conversionRate}%`, colors.violet],
              ["Unassigned", d!.totals.unassigned, colors.warning],
            ].map(([l, v, c]) => (
              <View key={String(l)} style={st.tile}>
                <Text style={[st.tileValue, { color: String(c) }]}>{String(v)}</Text>
                <Text style={st.tileLabel}>{String(l)}</Text>
              </View>
            ))}
          </View>
          <Card title="By website"><Bars rows={d!.byWebsite.map((w) => ({ label: w.name, value: Number(w.total), sub: pct(Number(w.converted), Number(w.total)) }))} /></Card>
          <Card title="By stage"><Bars rows={d!.byStatus.map((s) => ({ label: s.name, value: Number(s.total), color: statusTone[s.color]?.fg }))} /></Card>
          <Card title="Top sources"><Bars color={colors.gold} rows={d!.bySource.map((s) => ({ label: [s.source, s.medium].filter(Boolean).join(" / "), value: Number(s.total), sub: pct(Number(s.converted), Number(s.total)) }))} /></Card>
          {d!.byCampaign.length ? <Card title="Top campaigns"><Bars color={colors.violet} rows={d!.byCampaign.map((c) => ({ label: c.campaign, value: Number(c.total), sub: pct(Number(c.converted), Number(c.total)) }))} /></Card> : null}
          <Card title="Team performance"><Bars color={colors.success} rows={d!.byUser.map((u) => ({ label: u.full_name, value: Number(u.total), sub: `${u.open_leads} open · ${u.converted} won` }))} /></Card>
        </Screen>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 20, padding: 16, ...shadow.card },
  tileValue: { fontSize: 26, fontWeight: "800", letterSpacing: -0.6 },
  tileLabel: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: "#EEF0F6", overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
