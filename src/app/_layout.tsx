import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BrandSplash } from "@/components/BrandSplash";
import { ApiError } from "@/lib/api";
import { colors } from "@/lib/theme";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });
void SystemUI.setBackgroundColorAsync(colors.navyDeep);

function RootStack() {
  const { me, loading } = useAuth();
  const [splash, setSplash] = useState(true);
  const finish = useCallback(() => setSplash(false), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }} onLayout={() => void SplashScreen.hideAsync()}>
      <StatusBar style={splash ? "light" : "dark"} />
      {!loading ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page }, animation: "slide_from_right" }}>
          <Stack.Protected guard={!!me}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="lead/[id]" />
            <Stack.Screen name="lead/new" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
            <Stack.Screen name="account/profile" />
            <Stack.Screen name="account/password" />
            <Stack.Screen name="account/mobile" />
            <Stack.Screen name="account/email" />
            <Stack.Screen name="account/sessions" />
            <Stack.Screen name="account/notifications" />
            <Stack.Screen name="admin/index" />
            <Stack.Screen name="admin/requests" />
            <Stack.Screen name="admin/users" />
            <Stack.Screen name="admin/user/[id]" />
            <Stack.Screen name="admin/roles" />
            <Stack.Screen name="admin/org" />
            <Stack.Screen name="admin/statuses" />
            <Stack.Screen name="admin/integrations" />
            <Stack.Screen name="admin/analytics" />
            <Stack.Screen name="admin/settings" />
            <Stack.Screen name="admin/sessions" />
            <Stack.Screen name="admin/broadcast" />
            <Stack.Screen name="admin/audit" />
            <Stack.Screen name="admin/system" />
          </Stack.Protected>
          <Stack.Protected guard={!me}>
            <Stack.Screen name="login" options={{ animation: "fade" }} />
          </Stack.Protected>
        </Stack>
      ) : null}
      {splash ? <BrandSplash done={!loading} onFinish={finish} /> : null}
    </View>
  );
}

export default function RootLayout() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, e) => !(e instanceof ApiError && [401, 403, 404].includes(e.status)) && count < 2,
          },
        },
      }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
