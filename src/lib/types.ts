export type Me = {
  user: { id: number; full_name: string; email: string; mobile?: string | null; avatar?: string | null };
  roles: { code: string; name: string }[] | string[];
  permissions: string[];
  areas: { crm: boolean; admin: boolean; superAdmin: boolean };
};

export type LeadRow = {
  id: number;
  external_lead_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  interest: string | null;
  form_type: string | null;
  website_code: string | null;
  status_id: number;
  status_name: string;
  status_color: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  source_type?: string | null; // MANUAL | WEBSITE | META | …
  junk_reason?: string | null; // set when the lead was flagged as junk / test / repeat
  next_followup_at?: string | null;
  created_at: string;
  external_created_at?: string | null;
};

export type Activity = { id: number; type: string; actor: string | null; meta: unknown; created_at: string };
export type Note = { id: number; body: string; author: string | null; created_at: string };
export type Followup = {
  id: number;
  lead_id: number;
  due_at: string;
  status: "UPCOMING" | "OVERDUE" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  notes: string | null;
  owner: string | null;
  lead_name?: string | null;
  external_lead_id?: string;
  website_code?: string | null;
};

export type LeadDetail = LeadRow & {
  message: string | null;
  updated_at: string;
  team_name: string | null;
  attribution: Record<string, string | null> | null;
  activities: Activity[];
  notes: Note[];
  followups: Followup[];
  // Meta Lead Ads attribution (null for website / manual leads)
  source_lead_id?: string | null;
  campaign_id?: string | null; campaign_name?: string | null;
  ad_set_id?: string | null; ad_set_name?: string | null;
  ad_id?: string | null; ad_name?: string | null;
  form_id?: string | null; form_name?: string | null;
  page_id?: string | null;
  external_metadata?: unknown;
  duplicates?: { id: number; status: string; candidate_id: number; name: string | null; external_lead_id: string; website_code: string | null }[];
};

export type Paged<T> = { rows: T[]; meta: { page: number; limit: number; total: number; pages?: number } };

export type Status = { id: number; name: string; color: string | null; is_active: number | boolean; sort_order?: number };
export type Lookups = { statuses: Status[] };

export type Notification = { id: number; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };
