import Constants from "expo-constants";

/**
 * CRM server origin. Override for local testing with EXPO_PUBLIC_CRM_URL (e.g. http://192.168.1.20:3000),
 * otherwise app.json `extra.crmUrl` (production) is used.
 */
export const CRM_URL: string = (
  process.env.EXPO_PUBLIC_CRM_URL ||
  (Constants.expoConfig?.extra as { crmUrl?: string } | undefined)?.crmUrl ||
  "https://crm.ritzmediaworld.com"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  errorCode?: string;
  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
export const onUnauthorized = (fn: Listener) => {
  unauthorizedListeners.add(fn);
  return () => void unauthorizedListeners.delete(fn);
};

/**
 * The backend uses an httpOnly session cookie. React Native's native networking stores and resends
 * cookies automatically, so no token handling is needed here. Writes are protected by an Origin check,
 * so every request declares the CRM web origin (a native app has no Origin of its own).
 */
export async function api<T = unknown>(
  path: string,
  { method = "GET", body, signal }: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", Origin: CRM_URL, "X-Client": "rmw-crm-app" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${CRM_URL}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("No connection. Check your internet and try again.", 0, "NETWORK");
  }

  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; message?: string; errorCode?: string } | null;
  if (!res.ok || json?.success === false) {
    if (res.status === 401 && !path.startsWith("/auth/")) unauthorizedListeners.forEach((fn) => fn());
    throw new ApiError(json?.message || `Request failed (${res.status})`, res.status, json?.errorCode);
  }
  return (json?.data ?? null) as T;
}

export const apiMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
