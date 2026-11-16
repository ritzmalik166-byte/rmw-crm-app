import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Fab, MultiSelectField, SelectField, Sheet, StackHeader } from "@/components/kit";
import { Badge, Button, ErrorView, Input, Loading, Screen, T } from "@/components/ui";
import { useDepartments, useTeams, useWebsites, type Department, type Team } from "@/lib/admin";
import { api, apiMessage } from "@/lib/api";
import { confirm, useAction } from "@/lib/hooks";
import { colors, shadow } from "@/lib/theme";
import type { Paged } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

const keys = [["admin", "departments"], ["admin", "teams"]];

function DepartmentSheet({ dept, onClose }: { dept: Department | null; onClose: () => void }) {
  const [name, setName] = useState(dept?.name ?? "");
  const [description, setDescription] = useState(dept?.description ?? "");
  const [active, setActive] = useState(dept ? !!dept.is_active : true);
  const save = useAction(
    () => dept
      ? api(`/admin/departments/${dept.id}`, { method: "PATCH", body: { name: name.trim(), description: description.trim() || null, isActive: active } })
      : api("/admin/departments", { method: "POST", body: { name: name.trim(), description: description.trim() || null } }),
    { invalidate: keys, onDone: onClose },
  );
  const del = useAction(() => api(`/admin/departments/${dept!.id}`, { method: "DELETE" }), { invalidate: keys, onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={dept ? "Edit department" : "New department"}>
      <Input label="Name" value={name} onChangeText={setName} />
      <Input label="Description" value={description} onChangeText={setDescription} multiline />
      {dept ? <View style={st.switchRow}><T>Active</T><Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary }} thumbColor="#fff" /></View> : null}
      <Button title="Save" size="lg" onPress={() => save.mutate()} loading={save.isPending} disabled={name.trim().length < 2} />
      {dept ? <Button title="Delete department" variant="outline" onPress={() => confirm("Delete department?", "Only possible when it has no teams.", "Delete", () => del.mutate())} loading={del.isPending} /> : null}
    </Sheet>
  );
}

type Member = { id: number; full_name: string; email: string; status: string; is_lead: number };
type U = { id: number; full_name: string; email: string };

function TeamSheet({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const depts = useDepartments();
  const sites = useWebsites();
  const members = useQuery({ queryKey: ["admin", "team-members", team?.id], queryFn: () => api<Member[]>(`/admin/teams/${team!.id}/members`), enabled: !!team });
  const users = useInfiniteQuery({
    queryKey: ["admin", "users", "picker"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Paged<U>>(`/admin/users?status=ACTIVE&limit=100&page=${pageParam}`),
    getNextPageParam: (l) => (l.meta.page * l.meta.limit < l.meta.total ? l.meta.page + 1 : undefined),
    enabled: !!team,
  });
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [departmentId, setDepartmentId] = useState<number | null>(team?.department_id ?? null);
  const [websiteId, setWebsiteId] = useState<number | null>(team?.website_id ?? null);
  const [active, setActive] = useState(team ? !!team.is_active : true);
  const [memberIds, setMemberIds] = useState<number[] | null>(null);
  const [leads, setLeads] = useState<number[] | null>(null);
  const curMembers = memberIds ?? (members.data ?? []).map((m) => m.id);
  const curLeads = leads ?? (members.data ?? []).filter((m) => m.is_lead).map((m) => m.id);

  const save = useAction(async () => {
    const body = { name: name.trim(), departmentId, websiteId, description: description.trim() || null };
    if (!team) { await api("/admin/teams", { method: "POST", body }); return; }
    await api(`/admin/teams/${team.id}`, { method: "PATCH", body: { ...body, departmentId: departmentId ?? undefined, isActive: active } });
    if (memberIds || leads) await api(`/admin/teams/${team.id}/members`, { method: "PUT", body: { members: curMembers.map((userId) => ({ userId, isLead: curLeads.includes(userId) })) } });
  }, { invalidate: [...keys, ["admin", "team-members", team?.id]], onDone: onClose });
  const del = useAction(() => api(`/admin/teams/${team!.id}`, { method: "DELETE" }), { invalidate: keys, onDone: onClose });
  const userOpts = (users.data?.pages.flatMap((p) => p.rows) ?? []).map((u) => ({ value: u.id, label: u.full_name, sub: u.email }));

  return (
    <Sheet open onClose={onClose} title={team ? "Edit team" : "New team"}>
      <Input label="Name" value={name} onChangeText={setName} />
      <SelectField label="Department" icon="business-outline" value={departmentId} onChange={setDepartmentId} options={(depts.data ?? []).map((d) => ({ value: d.id as number | null, label: d.name }))} />
      <SelectField label="Website (optional)" icon="globe-outline" value={websiteId} onChange={setWebsiteId} options={[{ value: null, label: "Any website" }, ...(sites.data ?? []).map((w) => ({ value: w.id as number | null, label: w.name, sub: w.code }))]} />
      <Input label="Description" value={description} onChangeText={setDescription} multiline />
      {team ? (
        <>
          <View style={st.switchRow}><T>Active</T><Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary }} thumbColor="#fff" /></View>
          <MultiSelectField label={`Members · ${curMembers.length}`} values={curMembers} onChange={(v) => { setMemberIds(v); setLeads(curLeads.filter((x) => v.includes(x))); }} options={userOpts} placeholder="Add members" />
          {curMembers.length ? (
            <MultiSelectField label="Team leads" values={curLeads} onChange={setLeads} options={userOpts.filter((o) => curMembers.includes(o.value))} placeholder="None" />
          ) : null}
        </>
      ) : <T muted size={12}>Add members after creating the team.</T>}
      <Button title="Save" size="lg" onPress={() => save.mutate()} loading={save.isPending} disabled={name.trim().length < 2 || !departmentId} />
      {team ? <Button title="Delete team" variant="outline" onPress={() => confirm("Delete team?", "Members stay as users; only the team is removed.", "Delete", () => del.mutate())} loading={del.isPending} /> : null}
    </Sheet>
  );
}

export default function Org() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"departments" | "teams">("departments");
  const depts = useDepartments();
  const teams = useTeams();
  const [editDept, setEditDept] = useState<Department | "new" | null>(null);
  const [editTeam, setEditTeam] = useState<Team | "new" | null>(null);
  const canDept = can("department.manage");
  const canTeam = can("team.manage");
  const q = tab === "departments" ? depts : teams;

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Departments & teams" />
      <View style={st.tabs}>
        {(["departments", "teams"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabOn]}>
            <Text style={{ fontWeight: "700", color: tab === t ? colors.navy : colors.textMuted }}>{t === "departments" ? `Departments · ${depts.data?.length ?? 0}` : `Teams · ${teams.data?.length ?? 0}`}</Text>
          </Pressable>
        ))}
      </View>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
          {tab === "departments" ? depts.data!.map((d) => (
            <Pressable key={d.id} onPress={() => (canDept ? setEditDept(d) : Alert.alert(d.name, d.description || undefined))} style={st.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={st.name}>{d.name}</Text>
                {!d.is_active ? <Badge label="Inactive" bg="#EEF0F5" fg="#4A5070" /> : null}
              </View>
              <Text style={st.meta}>{d.team_count} team(s) · {d.user_count} user(s)</Text>
            </Pressable>
          )) : teams.data!.map((t) => (
            <Pressable key={t.id} onPress={() => (canTeam ? setEditTeam(t) : Alert.alert(t.name, t.description || undefined))} style={st.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={st.name}>{t.name}</Text>
                {t.website_code ? <Badge label={t.website_code} bg={colors.primarySoft} fg={colors.primary} /> : null}
                {!t.is_active ? <Badge label="Inactive" bg="#EEF0F5" fg="#4A5070" /> : null}
              </View>
              <Text style={st.meta}>{t.department_name} · {t.member_count} member(s)</Text>
            </Pressable>
          ))}
        </Screen>
      )}
      {(tab === "departments" ? canDept : canTeam) ? <Fab icon="add" label={tab === "departments" ? "New department" : "New team"} onPress={() => (tab === "departments" ? setEditDept("new") : setEditTeam("new"))} /> : null}
      {editDept ? <DepartmentSheet dept={editDept === "new" ? null : editDept} onClose={() => setEditDept(null)} /> : null}
      {editTeam ? <TeamSheet team={editTeam === "new" ? null : editTeam} onClose={() => setEditTeam(null)} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 6, backgroundColor: "#E9EBF3", borderRadius: 16, padding: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12 },
  tabOn: { backgroundColor: "#fff", ...shadow.card },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 16, gap: 4, ...shadow.card },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 16, padding: 14 },
});
