import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Fab, Sheet, StackHeader } from "@/components/kit";
import { Badge, Button, ErrorView, Input, Loading, Screen, T } from "@/components/ui";
import { rolePerms, useRoles, type Permission, type Role } from "@/lib/admin";
import { api, apiMessage } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { colors, shadow } from "@/lib/theme";
import { useAuth } from "@/providers/AuthProvider";

function PermissionEditor({ perms, value, onChange, readOnly }: { perms: Permission[]; value: string[]; onChange: (v: string[]) => void; readOnly?: boolean }) {
  const groups = useMemo(() => {
    const m = new Map<string, Permission[]>();
    perms.forEach((p) => m.set(p.group_name, [...(m.get(p.group_name) ?? []), p]));
    return [...m.entries()];
  }, [perms]);
  return (
    <>
      {groups.map(([g, list]) => (
        <View key={g} style={st.group}>
          <Text style={st.groupTitle}>{titleCase(g)}</Text>
          {list.map((p) => (
            <View key={p.code} style={st.permRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{p.description || p.code}</Text>
                <Text style={{ fontSize: 11.5, color: colors.textFaint }}>{p.code}</Text>
              </View>
              <Switch disabled={readOnly} value={value.includes(p.code)} onValueChange={(on) => onChange(on ? [...value, p.code] : value.filter((c) => c !== p.code))} trackColor={{ true: colors.primary, false: "#D5D8E6" }} thumbColor="#fff" />
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

function RoleSheet({ role, perms, onClose, canManage }: { role: Role | null; perms: Permission[]; onClose: () => void; canManage: boolean }) {
  const [codes, setCodes] = useState<string[]>(role ? rolePerms(role) : []);
  const [f, setF] = useState({ code: "", name: "", description: "", level: "10" });
  const locked = !canManage || role?.code === "OWNER";
  const save = useAction(
    () => role
      ? api(`/super-admin/roles/${role.id}/permissions`, { method: "PUT", body: { permissionCodes: codes } })
      : api("/super-admin/roles", { method: "POST", body: { code: f.code.trim().toUpperCase(), name: f.name.trim(), description: f.description.trim() || null, level: Number(f.level), permissionCodes: codes } }),
    { invalidate: [["admin", "roles"]], onDone: onClose },
  );
  return (
    <Sheet open onClose={onClose} title={role ? role.name : "New role"}>
      {!role ? (
        <>
          <Input label="Code (UPPER_SNAKE_CASE)" value={f.code} onChangeText={(v) => setF((s) => ({ ...s, code: v.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))} autoCapitalize="characters" placeholder="SALES_EXEC" />
          <Input label="Name" value={f.name} onChangeText={(v) => setF((s) => ({ ...s, name: v }))} placeholder="Sales executive" />
          <Input label="Level (1–99, higher = more senior)" value={f.level} onChangeText={(v) => setF((s) => ({ ...s, level: v.replace(/\D/g, "") }))} keyboardType="number-pad" />
          <Input label="Description" value={f.description} onChangeText={(v) => setF((s) => ({ ...s, description: v }))} />
        </>
      ) : <T muted size={13}>{role.description || `Level ${role.level}`} · {role.user_count} user(s){locked ? " · read only" : ""}</T>}
      <T bold size={15}>Permissions · {codes.length}</T>
      <PermissionEditor perms={perms} value={codes} onChange={setCodes} readOnly={locked} />
      {!locked ? (
        <Button title={role ? "Save permissions" : "Create role"} size="lg" onPress={() => save.mutate()} loading={save.isPending}
          disabled={!role && (!/^[A-Z][A-Z0-9_]{1,49}$/.test(f.code) || f.name.trim().length < 2 || !(Number(f.level) >= 1 && Number(f.level) <= 99))} />
      ) : null}
    </Sheet>
  );
}

export default function Roles() {
  const { canSA } = useAuth();
  const roles = useRoles();
  const perms = useQuery({ queryKey: ["admin", "permissions"], queryFn: () => api<Permission[]>("/super-admin/permissions"), enabled: canSA("role.view") });
  const [open, setOpen] = useState<Role | "new" | null>(null);
  const canManage = canSA("role.manage");

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Roles & permissions" subtitle={roles.data ? `${roles.data.length} roles` : undefined} />
      {roles.isLoading ? <Loading /> : roles.isError ? <ErrorView message={apiMessage(roles.error)} onRetry={() => void roles.refetch()} /> : (
        <Screen refreshing={roles.isRefetching} onRefresh={() => void roles.refetch()}>
          {roles.data!.map((r) => (
            <Pressable key={r.id} onPress={() => (perms.data ? setOpen(r) : Alert.alert(r.name, `${r.description || ""}\n\n${rolePerms(r).length} permissions · ${r.user_count} user(s)\n\nOnly a Super Admin can view or edit permissions.`))} style={({ pressed }) => [st.card, pressed && { transform: [{ scale: 0.985 }] }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{r.name}</Text>
                  {r.is_system ? <Badge label="System" bg={colors.primarySoft} fg={colors.primary} /> : null}
                </View>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>{r.code} · level {r.level} · {r.user_count} user(s) · {rolePerms(r).length} permissions</Text>
              </View>
            </Pressable>
          ))}
        </Screen>
      )}
      {canManage ? <Fab icon="add" label="New role" onPress={() => setOpen("new")} /> : null}
      {open && perms.data ? <RoleSheet role={open === "new" ? null : open} perms={perms.data} canManage={canManage} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 16, ...shadow.card },
  group: { backgroundColor: "#fff", borderRadius: 18, padding: 12, gap: 4, ...shadow.card },
  groupTitle: { fontSize: 13, fontWeight: "800", color: colors.primary, marginBottom: 4, letterSpacing: 0.3 },
  permRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
});
