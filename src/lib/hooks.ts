import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Alert } from "react-native";
import { api, apiMessage } from "@/lib/api";

/** can_client / can_meta: whether the person can see Client / Meta leads (role or extra grant). */
export type LookupUser = { id: number; full_name: string; email: string; can_client?: number | boolean; can_meta?: number | boolean };
export type LookupWebsite = { id: number; code: string; name: string };
export type LookupStatus = { id: number; name: string; color: string | null; is_active: number | boolean; sort_order?: number };
export type FullLookups = { statuses: LookupStatus[]; users: LookupUser[]; websites: LookupWebsite[]; sources: { id: number; name: string }[] };

export const useLookups = () => useQuery({ queryKey: ["lookups"], queryFn: () => api<FullLookups>("/crm/lookups"), staleTime: 10 * 60_000 });

/**
 * Mutation with the app's standard feedback: success haptic + optional message, error alert,
 * and invalidation of the given query keys.
 */
export function useAction<TVars = void, TRes = unknown>(
  fn: (v: TVars) => Promise<TRes>,
  { invalidate = [], success, onDone }: { invalidate?: QueryKey[]; success?: string; onDone?: (r: TRes, v: TVars) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      if (success) Alert.alert(success);
      onDone?.(r, v);
    },
    onError: (e) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Couldn't complete that", apiMessage(e));
    },
  });
}

export const confirm = (title: string, message: string, action: string, onYes: () => void, destructive = true) =>
  Alert.alert(title, message, [{ text: "Cancel", style: "cancel" }, { text: action, style: destructive ? "destructive" : "default", onPress: onYes }]);
