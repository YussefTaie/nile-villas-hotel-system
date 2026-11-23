import { useCallback, useEffect, useState } from 'react';
import { createDashboardService } from '../../application/dashboardService';
import { dashboardApi } from '../../infrastructure/dashboardApi';
import type { DashboardSummary } from '../../domain/dashboard';

const service = createDashboardService(dashboardApi);

export function useDashboardSummary(startDate: string, endDate: string, validRange: boolean) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(validRange);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let current = true;
    if (!validRange) {
      setSummary(null); setLoading(false); setError(null);
      return () => { current = false; };
    }
    setSummary(null); setLoading(true); setError(null);
    service.getSummary(startDate, endDate).then((result) => {
      if (current) setSummary(result);
    }).catch((reason: unknown) => {
      if (current) setError(reason instanceof Error ? reason.message : 'Unable to load dashboard summary.');
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [startDate, endDate, validRange, reloadKey]);

  return { summary, loading, error, reload };
}
