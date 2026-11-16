/** RMW CRM mobile design tokens: deep violet + warm gold, soft lavender surfaces. */
export const colors = {
  navy: "#2A1B5E",
  navyDeep: "#160E33",
  navySoft: "#3B2A7A",
  primary: "#5B3FD6",
  primarySoft: "#EFEAFF",
  gold: "#F2B54A",
  goldSoft: "#FFF5E3",
  saffron: "#F2994A",
  page: "#F5F3FC",
  card: "#FFFFFF",
  border: "#E6E1F5",
  text: "#1A1433",
  textMuted: "#6E6890",
  textFaint: "#A6A0C2",
  success: "#16A36A",
  successSoft: "#E6F7EF",
  danger: "#E5484D",
  dangerSoft: "#FDEEEE",
  warning: "#E8892B",
  warningSoft: "#FFF2E3",
  whatsapp: "#1DAA61",
  violet: "#7C5CFF",
  blue: "#3E6CF0",
};

export const gradients = {
  brand: ["#160E33", "#2A1B5E", "#4A2F9E"] as const,
  gold: ["#F7C766", "#EE9A3A"] as const,
  primary: ["#6C4FE8", "#4A2FC2"] as const,
  pipeline: ["#4F6BF5", "#7A5CF0", "#F2B54A", "#22B07D"] as const,
};

export const shadow = {
  card: { shadowColor: "#3B2A7A", shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  float: { shadowColor: "#2A1B5E", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
};

/** Status colours stored in the CRM (`lead_statuses.color`) → badge colours. */
export const statusTone: Record<string, { bg: string; fg: string }> = {
  slate: { bg: "#EEF0F5", fg: "#4A5070" },
  gray: { bg: "#EEF0F5", fg: "#4A5070" },
  blue: { bg: "#E8F0FE", fg: "#2563EB" },
  sky: { bg: "#E6F6FD", fg: "#0284C7" },
  indigo: { bg: "#ECEEFE", fg: "#4F46E5" },
  violet: { bg: "#F1ECFF", fg: "#6D28D9" },
  purple: { bg: "#F5ECFF", fg: "#7E22CE" },
  amber: { bg: "#FFF4DE", fg: "#B45309" },
  yellow: { bg: "#FFF8D6", fg: "#A16207" },
  orange: { bg: "#FFEEDF", fg: "#C2410C" },
  green: { bg: "#E6F7EC", fg: "#15803D" },
  emerald: { bg: "#E3F7EF", fg: "#047857" },
  teal: { bg: "#E2F6F4", fg: "#0F766E" },
  red: { bg: "#FDECEC", fg: "#B91C1C" },
  rose: { bg: "#FDEBEF", fg: "#BE123C" },
};

export const websiteTone: Record<string, { bg: string; fg: string; solid: string }> = {
  MPF: { bg: "#E2F6F4", fg: "#0F766E", solid: "#13A89A" },
  RMW: { bg: "#FFF5E3", fg: "#9A6A12", solid: "#E8A23A" },
  CT: { bg: "#F1ECFF", fg: "#6D28D9", solid: "#7C5CFF" },
};
