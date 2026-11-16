import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Fab, Sheet, StackHeader } from "@/components/kit";
import { Badge, Button, ErrorView, Input, Loading, Screen, StatusBadge, T } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { useAction, useLookups, type LookupStatus } from "@/lib/hooks";
import { colors, shadow, statusTone } from "@/lib/theme";
import { useAuth } from "@/providers/AuthProvider";

type S = LookupStatus & { code: string; is_default: number; is_conversion: number; is_closed: number };
const COLORS = Object.keys(statusTone);

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={st.toggle}>
      <View style={{ flex: 1 }}>
        <T bold size={14}>{label}</T>
        {hint ? <T muted size={12}>{hint}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: "#D5D8E6" }} thumbColor="#fff" />
    </View>
  );
}

function StatusSheet({ s, nextOrder, onClose }: { s: S | null; nextOrder: number; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(s?.name ?? "");
  const [color, setColor] = useState(s?.color ?? "slate");
  const [order, setOrder] = useState(String(s?.sort_order ?? nextOrder));
  const [conv, setConv] = useState(!!s?.is_conversion);
  const [closed, setClosed] = useState(!!s?.is_closed);
  const [active, setActive] = useState(s ? !!s.is_active : true);
  const [def, setDef] = useState(!!s?.is_default);
  const save = useAction(
    () => s
      ? api(`/admin/lead-statuses/${s.id}`, { method: "PATCH", body: { name: name.trim(), color, sortOrder: Number(order), isConversion: conv, isClosed: closed, isActive: active, isDefault: def } })
      : api("/admin/lead-statuses", { method: "POST", body: { code, name: name.trim(), color, sortOrder: Number(order), isConversion: conv, isClosed: closed } }),
    { invalidate: [["lookups"]], onDone: onClose },
  );
  return (
    <Sheet open onClose={onClose} title={s ? "Edit stage" : "New stage"}>
      {!s ? <Input label="Code (UPPER_SNAKE_CASE)" value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} autoCapitalize="characters" placeholder="SITE_VISIT" /> : <T muted size={13}>Code: {s.code}</T>}
      <Input label="Name" value={name} onChangeText={setName} placeholder="Site visit" />
      <View style={{ gap: 7 }}>
        <T muted size={13} bold>Colour</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={[st.swatch, { backgroundColor: statusTone[c]!.bg, borderColor: color === c ? statusTone[c]!.fg : "transparent" }]}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: statusTone[c]!.fg }} />
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row" }}><StatusBadge name={name || "Preview"} color={color} /></View>
      </View>
      <Input label="Order" value={order} onChangeText={(v) => setOrder(v.replace(/\D/g, ""))} keyboardType="number-pad" />
      <Toggle label="Counts as converted" hint="Won / booked deals" value={conv} onChange={setConv} />
      <Toggle label="Closed stage" hint="No further follow-up expected" value={closed} onChange={setClosed} />
      {s ? <Toggle label="Active" value={active} onChange={setActive} /> : null}
      {s ? <Toggle label="Default for new leads" value={def} onChange={setDef} /> : null}
      <Button title="Save" size="lg" onPress={() => save.mutate()} loading={save.isPending} disabled={!name.trim() || (!s && !/^[A-Z][A-Z0-9_]{1,39}$/.test(code))} />
    </Sheet>
  );
}

export default function Statuses() {
  const { can } = useAuth();
  const lk = useLookups();
  const [edit, setEdit] = useState<S | "new" | null>(null);
  const list = ([...(lk.data?.statuses ?? [])] as S[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const manage = can("lead_config.manage");
  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Lead stages" subtitle="The pipeline every lead moves through" />
      {lk.isLoading ? <Loading /> : lk.isError ? <ErrorView message={apiMessage(lk.error)} onRetry={() => void lk.refetch()} /> : (
        <Screen refreshing={lk.isRefetching} onRefresh={() => void lk.refetch()}>
          {list.map((s, i) => (
            <Pressable key={s.id} disabled={!manage} onPress={() => setEdit(s)} style={st.card}>
              <Text style={st.order}>{i + 1}</Text>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <StatusBadge name={s.name} color={s.color} />
                  {s.is_default ? <Badge label="Default" bg={colors.primarySoft} fg={colors.primary} /> : null}
                  {s.is_conversion ? <Badge label="Converted" bg={colors.successSoft} fg={colors.success} /> : null}
                  {s.is_closed ? <Badge label="Closed" bg="#EEF0F5" fg="#4A5070" /> : null}
                  {!s.is_active ? <Badge label="Inactive" bg={colors.dangerSoft} fg={colors.danger} /> : null}
                </View>
                <Text style={{ fontSize: 12, color: colors.textFaint }}>{s.code}</Text>
              </View>
            </Pressable>
          ))}
        </Screen>
      )}
      {manage ? <Fab icon="add" label="New stage" onPress={() => setEdit("new")} /> : null}
      {edit ? <StatusSheet s={edit === "new" ? null : edit} nextOrder={(list.at(-1)?.sort_order ?? 0) + 10} onClose={() => setEdit(null)} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#fff", borderRadius: 20, padding: 14, ...shadow.card },
  order: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, color: colors.primary, textAlign: "center", lineHeight: 28, fontWeight: "800" },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 14 },
});
