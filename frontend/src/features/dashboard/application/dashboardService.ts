import type { DashboardRepository } from './DashboardRepository';

export function createDashboardService(repository: DashboardRepository) {
  return { getSummary: (startDate: string, endDate: string) => repository.getSummary(startDate, endDate) };
}
