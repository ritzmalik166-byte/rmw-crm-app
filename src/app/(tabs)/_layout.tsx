import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { IconName } from "@/components/ui";
import { colors, gradients, shadow } from "@/lib/theme";
import { useAuth } from "@/providers/AuthProvider";

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: "Home", icon: "home" },
  leads: { label: "Leads", icon: "people" },
  followups: { label: "Tasks", icon: "checkbox" },
  profile: { label: "More", icon: "grid" },
};
const ORDER = ["index", "leads", "+", "followups", "profile"];

/** Docked bottom bar with a raised centre "+" (new lead), like the reference design. Alerts live on the Home bell. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { can } = useAuth();
  return (
    <View style={[st.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {ORDER.map((name) => {
        if (name === "+") {
          return (
            <View key="fab" style={st.item}>
              {can("lead.create") ? (
                <Pressable
                  accessibilityLabel="New lead"
                  onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/lead/new"); }}
                  style={({ pressed }) => [st.fabRing, pressed && { transform: [{ scale: 0.94 }] }]}
                >
                  <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.fab}>
                    <Ionicons name="add" size={30} color="#fff" />
                  </LinearGradient>
                </Pressable>
              ) : null}
            </View>
          );
        }
        const i = state.routes.findIndex((r) => r.name === name);
        const route = state.routes[i];
        const tab = TABS[name];
        if (!route || !tab) return null;
        const focused = state.index === i;
        const tint = focused ? colors.primary : colors.textFaint;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              if (focused) return;
              void Haptics.selectionAsync();
              navigateToTab(route.key);
            }}
            style={st.item}
          >
            <Ionicons name={(focused ? tab.icon : `${tab.icon}-outline`) as IconName} size={23} color={tint} />
            <Text style={[st.label, { color: tint }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="leads" />
      <Tabs.Screen name="followups" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const st = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "flex-end", backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 8, ...shadow.float },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: 52 },
  label: { fontWeight: "600", fontSize: 11.5 },
  fabRing: { marginTop: -34, padding: 5, borderRadius: 40, backgroundColor: "#fff" },
  fab: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", ...shadow.float },
});
