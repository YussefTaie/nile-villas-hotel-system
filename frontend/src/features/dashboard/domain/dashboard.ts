export type DashboardCurrency = 'USD' | 'EUR' | 'EGP';

export interface ReportingPeriod {
  startDate: string;
  endDate: string;
  timezone: string;
}

export interface InvoiceSalesSummary {
  completedInvoiceCount: number;
  totalSalesUsd: string;
}

export interface CurrencyFinancialSummary {
  currency: DashboardCurrency;
  recordCount: number;
  originalAmount: string;
  amountUsdEquivalent: string;
}

export interface TransactionSummary {
  recordCount: number;
  totalAmountUsdEquivalent: string;
  byCurrency: CurrencyFinancialSummary[];
}

export interface DashboardSummary {
  period: ReportingPeriod;
  invoiceSales: InvoiceSalesSummary;
  paymentCollections: TransactionSummary;
  tips: TransactionSummary;
}
