const dtf = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const formatDateTime = (v?: string | null) => (v ? dtf.format(new Date(v)) : "—");

export function timeAgo(v?: string | null) {
  if (!v) return "—";
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  const future = s < 0;
  const a = Math.abs(s);
  const out =
    a < 60 ? "just now" : a < 3600 ? `${Math.floor(a / 60)}m` : a < 86400 ? `${Math.floor(a / 3600)}h` : a < 604800 ? `${Math.floor(a / 86400)}d` : formatDateTime(v);
  if (out === "just now" || out.includes(" ")) return out;
  return future ? `in ${out}` : `${out} ago`;
}

export const titleCase = (s?: string | null) =>
  String(s || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const initials = (n?: string | null) =>
  String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

/** wa.me link for an Indian number; null when the number can't be used. */
export function whatsappUrl(phone?: string | null) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return `https://wa.me/91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `https://wa.me/${d}`;
  return null;
}
