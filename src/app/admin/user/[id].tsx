import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { Group, ListRow, MultiSelectField, SelectField, StackHeader } from "@/components/kit";
import { Avatar, Button, ErrorView, Input, Loading, Screen, T } from "@/components/ui";
import { PASSWORD_RULES, strongPassword, useDepartments, useRoles, useTeams, useWebsites } from "@/lib/admin";
import { api, apiMessage } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { confirm, useAction } from "@/lib/hooks";
import { colors } from "@/lib/theme";
import { useAuth } from "@/providers/AuthProvider";

type UserDetail = {
  id: number; full_name: string; email: string; mobile: string | null; avatar: string | null; status: string; department_id: number | null;
  roleIds: number[]; websiteIds: number[]; teamIds: number[];
  /** Lead channel permissions granted to this user directly, and which of them the role already includes. */
  extraPermissions?: string[]; rolePermissions?: string[];
};

const CHANNELS = [
  { perm: "lead.channel.client", label: "Client Leads", icon: "briefcase-outline" as const },
  { perm: "lead.channel.meta", label: "Meta Leads", icon: "logo-facebook" as const },
];

function Form({ user }: { user: UserDetail | null }) {
  const { can, canSA, me } = useAuth();
  const isNew = !user;
  const roles = useRoles();
  const depts = useDepartments();
  const teams = useTeams();
  const sites = useWebsites();
  const [f, setF] = useState({ fullName: user?.full_name ?? "", email: user?.email ?? "", mobile: user?.mobile ?? "", password: "" });
  const [roleId, setRoleId] = useState<number | null>(user?.roleIds[0] ?? null);
  const [departmentId, setDepartmentId] = useState<number | null>(user?.department_id ?? null);
  const [teamIds, setTeamIds] = useState<number[]>(user?.teamIds ?? []);
  const [websiteIds, setWebsiteIds] = useState<number[]>(user?.websiteIds ?? []);
  const [extra, setExtra] = useState<string[]>(user?.extraPermissions ?? []);
  const fromRole = new Set(user?.rolePermissions ?? []);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const keys = [["admin", "users"], ["admin", "user", String(user?.id)]];

  const save = useAction(
    () => isNew
      ? api("/admin/users", { method: "POST", body: { fullName: f.fullName.trim(), email: f.email.trim(), mobile: f.mobile.trim(), password: f.password, roleId, departmentId, teamIds, websiteIds } })
      : api(`/admin/users/${user.id}`, { method: "PATCH", body: { fullName: f.fullName.trim(), roleId: roleId ?? undefined, departmentId, teamIds, websiteIds, extraPermissions: extra, ...(f.password ? { newPassword: f.password } : {}) } }),
    { invalidate: keys, success: isNew ? "User created" : "User updated", onDone: () => router.back() },
  );
  const setStatus = useAction((status: string) => api(`/admin/users/${user!.id}/status`, { method: "POST", body: { status } }), { invalidate: keys });
  const kill = useAction(() => api(`/super-admin/users/${user!.id}/terminate-sessions`, { method: "POST" }), { success: "Signed out of all devices" });

  const editable = isNew ? can("user.create") : can("user.edit");
  const self = user?.id === me?.user.id;
  const pwOk = isNew ? strongPassword(f.password) : !f.password || strongPassword(f.password);
  const valid = f.fullName.trim().length >= 2 && roleId && pwOk && (!isNew || (f.email.trim() && f.mobile.trim()));

  return (
    <Screen>
      {user ? (
        <View style={{ alignItems: "center", gap: 6, paddingVertical: 6 }}>
          <Avatar name={user.full_name} src={user.avatar} size={72} />
          <T muted size={13}>{user.email} · {titleCase(user.status)}</T>
        </View>
      ) : null}
      <Input label="Full name" icon="person-outline" value={f.fullName} onChangeText={set("fullName")} editable={editable} autoCapitalize="words" />
      {isNew ? (
        <>
          <Input label="Email" icon="mail-outline" value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Mobile" icon="call-outline" value={f.mobile} onChangeText={set("mobile")} keyboardType="phone-pad" />
        </>
      ) : null}
      <SelectField label="Role" icon="shield-outline" value={roleId} onChange={setRoleId} options={(roles.data ?? []).map((r) => ({ value: r.id as number | null, label: r.name, sub: `Level ${r.level}` }))} />
      <MultiSelectField label="Website access" values={websiteIds} onChange={setWebsiteIds} options={(sites.data ?? []).map((w) => ({ value: w.id, label: w.name, sub: w.code }))} />
      <SelectField label="Department" icon="business-outline" value={departmentId} onChange={setDepartmentId} options={[{ value: null, label: "None" }, ...(depts.data ?? []).map((d) => ({ value: d.id as number | null, label: d.name }))]} />
      <MultiSelectField label="Teams" values={teamIds} onChange={setTeamIds} options={(teams.data ?? []).map((t) => ({ value: t.id, label: t.name, sub: t.department_name }))} placeholder="None" />
      {!isNew ? (
        <View style={{ gap: 7 }}>
          <T muted size={13} bold>Lead access</T>
          <Group>
            {CHANNELS.map((c, i) => {
              const byRole = fromRole.has(c.perm);
              const on = byRole || extra.includes(c.perm);
              return (
                <ListRow key={c.perm} icon={c.icon} label={c.label} last={i === CHANNELS.length - 1}
                  right={
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <Switch value={on} disabled={byRole || !editable} trackColor={{ true: colors.primary, false: colors.border }}
                        onValueChange={(v) => setExtra((xs) => (v ? [...xs.filter((x) => x !== c.perm), c.perm] : xs.filter((x) => x !== c.perm)))} />
                      {byRole ? <Text style={{ fontSize: 11, color: colors.textMuted }}>Included by their role</Text> : null}
                    </View>
                  } />
              );
            })}
          </Group>
          <T muted size={12}>Extra lead channels for this user only, on top of their role. Given automatically when you assign them a client or Meta lead.</T>
        </View>
      ) : null}
      <Input label={isNew ? "Password" : "Set a new password (optional)"} icon="key-outline" value={f.password} onChangeText={set("password")} secureTextEntry />
      {f.password || isNew ? (
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          {PASSWORD_RULES.map(([l, ok]) => <T key={l} size={12.5} style={{ color: ok(f.password) ? colors.success : colors.textMuted }}>{ok(f.password) ? "✓" : "•"} {l}</T>)}
        </View>
      ) : null}
      {editable ? <Button title={isNew ? "Create user" : "Save changes"} size="lg" onPress={() => save.mutate()} loading={save.isPending} disabled={!valid} /> : null}

      {user && !self && (can("user.disable") || canSA("session.revoke_any")) ? (
        <Group>
          {can("user.disable") ? (["ACTIVE", "DISABLED", "SUSPENDED", ...(can("user.block") ? ["BLOCKED"] : [])] as string[]).filter((s) => s !== user.status).map((s) => (
            <ListRow key={s} icon={s === "ACTIVE" ? "checkmark-circle" : s === "BLOCKED" ? "ban" : "pause-circle"} tone={s === "ACTIVE" ? colors.success : colors.warning} danger={s === "BLOCKED"}
              label={s === "ACTIVE" ? "Activate account" : s === "DISABLED" ? "Disable account" : s === "SUSPENDED" ? "Suspend account" : "Block account"}
              onPress={() => confirm(`${titleCase(s)} ${user.full_name}?`, s === "ACTIVE" ? "They will be able to sign in again." : "They will be signed out and can't sign in.", "Confirm", () => setStatus.mutate(s), s !== "ACTIVE")} />
          )) : null}
          {canSA("session.revoke_any") ? <ListRow icon="log-out" tone={colors.danger} label="Sign out of all devices" last onPress={() => confirm("Sign out everywhere?", "All their sessions will end and trusted devices are reset.", "Sign out", () => kill.mutate())} /> : null}
        </Group>
      ) : null}
    </Screen>
  );
}

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const q = useQuery({ queryKey: ["admin", "user", id], queryFn: () => api<UserDetail>(`/admin/users/${id}`), enabled: !isNew });
  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={isNew ? "New user" : q.data?.full_name ?? "User"} subtitle={isNew ? "Create an account directly" : undefined} />
      {isNew ? <Form user={null} /> : q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : <Form key={q.dataUpdatedAt} user={q.data!} />}
    </View>
  );
}
