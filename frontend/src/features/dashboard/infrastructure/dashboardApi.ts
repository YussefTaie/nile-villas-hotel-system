import { request } from '../../../shared/api/apiClient';
import type { DashboardCurrency, DashboardSummary } from '../domain/dashboard';
import type { DashboardRepository } from '../application/DashboardRepository';

interface SummaryResponse {
  period: { start_date: string; end_date: string; timezone: string };
  invoice_sales: { completed_invoice_count: number; total_sales_usd: string };
  payment_collections: { record_count: number; total_amount_usd_equivalent: string; by_currency: Array<{ currency: DashboardCurrency; record_count: number; original_amount: string; amount_usd_equivalent: string }> };
  tips: { record_count: number; total_amount_usd_equivalent: string; by_currency: Array<{ currency: DashboardCurrency; record_count: number; original_amount: string; amount_usd_equivalent: string }> };
}

const mapTransactions = (value: SummaryResponse['payment_collections']) => ({
  recordCount: value.record_count,
  totalAmountUsdEquivalent: value.total_amount_usd_equivalent,
  byCurrency: value.by_currency.map((row) => ({
    currency: row.currency, recordCount: row.record_count,
    originalAmount: row.original_amount, amountUsdEquivalent: row.amount_usd_equivalent,
  })),
});

export const dashboardApi: DashboardRepository = {
  async getSummary(startDate: string, endDate: string): Promise<DashboardSummary> {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    const value = await request<SummaryResponse>(`/dashboard/summary?${params.toString()}`);
    return {
      period: { startDate: value.period.start_date, endDate: value.period.end_date, timezone: value.period.timezone },
      invoiceSales: { completedInvoiceCount: value.invoice_sales.completed_invoice_count, totalSalesUsd: value.invoice_sales.total_sales_usd },
      paymentCollections: mapTransactions(value.payment_collections),
      tips: mapTransactions(value.tips),
    };
  },
};
