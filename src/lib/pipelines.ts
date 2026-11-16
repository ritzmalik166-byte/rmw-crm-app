import type { ImageSourcePropType } from "react-native";

export type PipelineKey = "mpf" | "rmw" | "ct";
export type PipelineCounts = { total: number; new_leads: number; unassigned: number; converted: number; today: number; overdue: number };

/** The three business pipelines shown on Home and as Leads filters. Order matches the web dashboard. */
export const PIPELINES: { key: PipelineKey; title: string; short: string; site: string; logo: ImageSourcePropType; tone: string }[] = [
  { key: "mpf", title: "MPF Leads", short: "MPF", site: "MyPropertyFact", logo: require("../../assets/images/mpf-mark.png"), tone: "#13A89A" },
  { key: "rmw", title: "RMW Leads", short: "RMW", site: "Ritz Media World", logo: require("../../assets/images/rmw-mark.png"), tone: "#E8A23A" },
  { key: "ct", title: "CT Leads", short: "CT", site: "Contenaissance", logo: require("../../assets/images/ct-mark.png"), tone: "#7C5CFF" },
];

export const pipelineFor = (code?: string | null) => PIPELINES.find((p) => p.short === code);
