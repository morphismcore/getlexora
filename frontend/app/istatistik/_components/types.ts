export interface ChamberStat { daire: string; count: number; percentage: number; }
export interface YearStat { year: number; count: number; }
export interface CourtStats {
  topic: string; court_type: string; total_decisions: number;
  by_chamber: ChamberStat[]; by_year: YearStat[];
  most_active_chamber: string | null; note: string;
}
export interface CompareResponse { topics: string[]; court_type: string; comparisons: CourtStats[]; }
export interface DashboardStats {
  total_cases: number; total_searches: number;
  upcoming_deadlines: number; total_embeddings: number;
  cases_by_type: Record<string, number>;
  cases_by_status: Record<string, number>;
  recent_searches: string[];
  deadline_completion_rate: number;
}
