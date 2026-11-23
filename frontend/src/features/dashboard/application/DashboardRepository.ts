import type { DashboardSummary } from '../domain/dashboard';

export interface DashboardRepository {
  getSummary(startDate: string, endDate: string): Promise<DashboardSummary>;
}
