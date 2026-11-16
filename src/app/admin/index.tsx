import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { View } from "react-native";
import { Group, ListRow, StackHeader } from "@/components/kit";
import { Screen, T, type IconName } from "@/components/ui";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";
import type { Paged } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

type Item = { icon: IconName; tone: string; label: string; href: Href; perm: string | string[]; badge?: number; sa?: boolean };

/** Every admin / super admin section the web has, gated by the same permissions the API enforces. */
export default function AdminHub() {
  const { can, canSA } = useAuth();
  const pending = useQuery({
    queryKey: ["admin", "requests", "count"],
    queryFn: () => api<Paged<unknown>>("/admin/user-requests?status=PENDING_APPROVAL&limit=1"),
    enabled: can("user.view"),
  });
  const has = (p: string | string[], sa?: boolean) => { const fn = sa ? canSA : can; return Array.isArray(p) ? p.some(fn) : fn(p); };

  const groups: { title: string; items: Item[] }[] = [
    {
      title: "People",
      items: [
        { icon: "person-add", tone: colors.violet, label: "Access requests", href: "/admin/requests", perm: "user.view", badge: pending.data?.meta.total },
        { icon: "people", tone: colors.blue, label: "Users", href: "/admin/users", perm: "user.view" },
        { icon: "shield-checkmark", tone: colors.primary, label: "Roles & permissions", href: "/admin/roles", perm: "role.view" },
        { icon: "business", tone: colors.success, label: "Departments & teams", href: "/admin/org", perm: ["department.manage", "team.manage", "user.view"] },
      ],
    },
    {
      title: "Leads",
      items: [
        { icon: "pricetags", tone: colors.warning, label: "Lead stages", href: "/admin/statuses", perm: ["lead_config.manage", "lead.view"] },
        { icon: "git-network", tone: "#0284C7", label: "Websites & integrations", href: "/admin/integrations", perm: ["integration.view", "website.manage"] },
        { icon: "bar-chart", tone: colors.violet, label: "Analytics", href: "/admin/analytics", perm: "analytics.view" },
      ],
    },
    {
      title: "System",
      items: [
        { icon: "settings", tone: colors.textMuted, label: "System settings", href: "/admin/settings", perm: "settings.view" },
        { icon: "phone-portrait", tone: colors.blue, label: "All active sessions", href: "/admin/sessions", perm: "session.view_all", sa: true },
        { icon: "megaphone", tone: colors.danger, label: "Broadcast notification", href: "/admin/broadcast", perm: "notification.broadcast", sa: true },
        { icon: "document-text", tone: colors.primary, label: "Audit log", href: "/admin/audit", perm: "audit.view" },
        { icon: "pulse", tone: colors.success, label: "System health", href: "/admin/system", perm: "settings.view", sa: true },
      ],
    },
  ];

  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => has(i.perm, i.sa)) })).filter((g) => g.items.length);

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Administration" subtitle="Everything from the web admin, on your phone" />
      <Screen>
        {visible.length === 0 ? <T muted>Your role doesn&apos;t include any admin tools.</T> : visible.map((g) => (
          <View key={g.title} style={{ gap: 8 }}>
            <T bold size={15} style={{ marginLeft: 4 }}>{g.title}</T>
            <Group>
              {g.items.map((i, idx) => (
                <ListRow key={i.label} icon={i.icon} tone={i.tone} label={i.label} value={i.badge ? `${i.badge} pending` : undefined} onPress={() => router.push(i.href)} last={idx === g.items.length - 1} />
              ))}
            </Group>
          </View>
        ))}
      </Screen>
    </View>
  );
}
