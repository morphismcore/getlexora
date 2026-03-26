/* ------------------------------------------------------------------ */
/*  Dashboard types                                                     */
/* ------------------------------------------------------------------ */

export interface DeadlineItem {
  id: string;
  title: string;
  deadline_date: string;
  deadline_type: string;
  law_reference: string | null;
  urgency: string;
  days_left: number;
  business_days_left: number;
  is_completed: boolean;
  case_id: string;
  case_title: string;
  case_type: string;
  court: string | null;
  case_number: string | null;
}

export interface CaseSummary {
  id: string;
  title: string;
  case_type: string;
  court: string | null;
  case_number: string | null;
  opponent: string | null;
  status: string;
  updated_at: string;
  next_deadline: { title: string; deadline_date: string; days_left: number; urgency: string } | null;
  deadline_count: number;
  document_count: number;
}

export interface RecentEvent {
  id: string;
  event_type: string;
  event_type_label: string;
  event_date: string;
  case_title: string;
  case_id: string;
  created_at: string;
}

export interface SavedSearch {
  id: string;
  query: string;
  search_type: string;
  result_count: number;
  created_at: string;
}

export interface Decision {
  karar_id: string;
  daire: string;
  esas_no: string;
  karar_no: string;
  tarih: string;
}

export interface DashboardData {
  stats: {
    total_cases: number;
    active_cases: number;
    upcoming_deadlines: number;
    overdue_deadlines: number;
    today_deadlines: number;
    tomorrow_deadlines: number;
    critical_deadlines: number;
    total_searches: number;
    qdrant_documents: number;
  };
  deadlines: {
    overdue: DeadlineItem[];
    today: DeadlineItem[];
    this_week: DeadlineItem[];
    next_week: DeadlineItem[];
    later: DeadlineItem[];
  };
  cases: CaseSummary[];
  cases_by_type: Record<string, number>;
  cases_by_status: Record<string, number>;
  recent_events: RecentEvent[];
  recent_searches: SavedSearch[];
  new_decisions: Decision[];
  system_health: Record<string, any>;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
