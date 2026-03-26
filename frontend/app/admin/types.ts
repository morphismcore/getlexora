// ── Interfaces ───────────────────────────────────────

export interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  baro: string | null;
  baro_sicil_no: string | null;
  is_active: boolean;
  created_at: string | null;
  firm_id: string | null;
}

export interface FirmItem {
  id: string;
  name: string;
  email: string | null;
  member_count: number;
  active_member_count: number;
  max_users: number;
  firm_type: string;
  is_active: boolean;
  created_at: string | null;
}

export interface PlatformStats {
  users: { total: number; active: number; pending: number };
  firms: number;
  cases: number;
  deadlines: number;
  searches: number;
}

export interface EmbeddingStats {
  ictihat: { points_count: number };
  mevzuat: { points_count: number };
  total: number;
}

export interface IngestionState {
  running: boolean;
  source: string | null;
  task: string | null;
  started_at: string | null;
  fetched: number;
  embedded: number;
  errors: number;
  total_topics: number;
  completed_topics: number;
  new_logs?: LogEntry[];
}

export interface LogEntry {
  ts: string;
  level: string;
  msg: string;
}

export interface EmbeddingBreakdown {
  sources: Record<string, number>;
  mevzuat: number;
  total: number;
}

// Deadline management interfaces
export interface DeadlineRule {
  id: string;
  event_type_id: string;
  name: string;
  duration_value: number;
  duration_unit: string;
  deadline_type: string;
  law_reference: string;
  affects_by_judicial_recess: boolean;
  affects_by_holidays: boolean;
  description: string;
  is_active: boolean;
}

export interface EventType {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  is_active: boolean;
  rules: DeadlineRule[];
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  holiday_type: string;
  is_half_day: boolean;
  year: number;
}

export interface JudicialRecess {
  id: string;
  year: number;
  start_date: string;
  end_date: string;
  civil_extension_days: number;
  criminal_extension_days: number;
  administrative_extension_days: number;
}

export interface DeadlineStats {
  event_type_count: number;
  rule_count: number;
  category_count: number;
  holiday_years: number;
}

export interface MonitoringData {
  uptime_seconds: number;
  requests_total: number;
  requests_per_minute: number;
  avg_response_time_ms: number;
  error_rate_pct: number;
  active_connections: number;
  memory_usage_mb: number;
  cpu_percent: number;
  disk_usage_pct: number;
  services: Record<string, { status: string; response_ms: number; memory_mb?: number; error?: string }>;
  ingestion: {
    total_embeddings: number;
    by_source: Record<string, number>;
    last_ingestion: string | null;
    daily_new_count: number;
  };
}

export interface HistoryPoint {
  ts: number;
  cpu_percent: number;
  memory_usage_mb: number;
  requests_per_minute: number;
  avg_response_time_ms: number;
  error_rate_pct: number;
  requests_total: number;
}

export interface IngestConfig {
  yargitay_year_from: number;
  danistay_year_from: number;
  [key: string]: number;
}

export interface RuleFormData {
  name: string;
  duration_value: number;
  duration_unit: string;
  deadline_type: string;
  law_reference: string;
  affects_by_judicial_recess: boolean;
  affects_by_holidays: boolean;
  description: string;
  is_active: boolean;
}

export type TabKey = "genel" | "kullanicilar" | "veri-yonetimi" | "sistem";
