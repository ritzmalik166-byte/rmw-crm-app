import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Group, ListRow } from "@/components/kit";
import { Avatar } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { pickAvatar } from "@/lib/avatar";
import { titleCase } from "@/lib/format";
import { colors, gradients, shadow } from "@/lib/theme";
import { useAuth } from "@/providers/AuthProvider";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { me, logout, refresh, can } = useAuth();
  const [uploading, setUploading] = useState(false);
  const roles = (me?.roles ?? []).map((r) => (typeof r === "string" ? r : r.name || r.code)).map(titleCase).join(" · ");
  const isAdmin = can("area.admin") || can("area.super_admin");

  const save = async (avatar: string | null) => {
    setUploading(true);
    try { await api("/auth/me/avatar", { method: "PUT", body: { avatar } }); await refresh(); } catch (e) { Alert.alert("Couldn't update photo", apiMessage(e)); } finally { setUploading(false); }
  };
  const choose = (src: "camera" | "library") => async () => {
    try { const url = await pickAvatar(src); if (url) await save(url); } catch (e) { Alert.alert("Photo", apiMessage(e)); }
  };
  const changePhoto = () =>
    Alert.alert("Profile photo", undefined, [
      { text: "Take photo", onPress: choose("camera") },
      { text: "Choose from gallery", onPress: choose("library") },
      ...(me?.user.avatar ? [{ text: "Remove photo", style: "destructive" as const, onPress: () => void save(null) }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.page }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.hero, { paddingTop: insets.top + 24 }]}>
        <Pressable onPress={changePhoto} accessibilityLabel="Change profile photo">
          <View style={st.avatarRing}>
            <Avatar name={me?.user.full_name} src={me?.user.avatar} size={84} tone={colors.gold} />
            {uploading ? <View style={st.uploading}><ActivityIndicator color="#fff" /></View> : null}
          </View>
          <View style={st.camera}><Ionicons name="camera" size={15} color="#fff" /></View>
        </Pressable>
        <Text style={st.name}>{me?.user.full_name}</Text>
        <Text style={st.email}>{me?.user.email}</Text>
        {roles ? <View style={st.role}><Ionicons name="shield-checkmark" size={13} color={colors.gold} /><Text style={st.roleText}>{roles}</Text></View> : null}
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, marginTop: -24, gap: 18 }}>
        <Group>
          <ListRow icon="person-circle" tone={colors.blue} label="Name" value={me?.user.full_name} onPress={() => router.push("/account/profile")} />
          <ListRow icon="call" tone={colors.success} label="Mobile" value={me?.user.mobile || "Add"} onPress={() => router.push("/account/mobile")} />
          <ListRow icon="mail" tone={colors.violet} label="Email" value={me?.user.email} onPress={() => router.push("/account/email")} last />
        </Group>

        <Group>
          <ListRow icon="key" tone={colors.warning} label="Change password" onPress={() => router.push("/account/password")} />
          <ListRow icon="phone-portrait" tone={colors.primary} label="Devices & sessions" onPress={() => router.push("/account/sessions")} />
          <ListRow icon="notifications" tone={colors.danger} label="Notification settings" onPress={() => router.push("/account/notifications")} last />
        </Group>

        {isAdmin ? (
          <Group>
            <ListRow icon="shield-checkmark" tone={colors.gold} label="Administration" value={can("area.super_admin") ? "Super admin" : "Admin"} onPress={() => router.push("/admin" as Href)} last />
          </Group>
        ) : null}

        <Group>
          <ListRow icon="information-circle" tone={colors.textMuted} label="App version" value={`v${Constants.expoConfig?.version ?? "1.0.0"}`} />
          <ListRow
            icon="log-out"
            label="Sign out"
            danger
            last
            onPress={() => Alert.alert("Sign out?", "You'll need to sign in again on this device.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: () => void logout() }])}
          />
        </Group>
        <Text style={{ textAlign: "center", color: colors.textFaint, fontSize: 12 }}>RMW CRM · Ritz Media World Group</Text>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: "center", paddingBottom: 48, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  avatarRing: { padding: 3, borderRadius: 48, backgroundColor: "#fff", ...shadow.float },
  uploading: { position: "absolute", top: 3, left: 3, width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  camera: { position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  name: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 14, letterSpacing: -0.4 },
  email: { color: "rgba(255,255,255,0.65)", fontSize: 14, marginTop: 4 },
  role: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  roleText: { color: "#fff", fontSize: 12.5, fontWeight: "600" },
});
