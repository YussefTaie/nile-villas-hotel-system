import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { appRoutes, featureRoutes } from './routeConfig';
import { PlaceholderPage } from './PlaceholderPage';
import { ProductManagementPage } from '../../features/catalog/presentation/ProductManagementPage';
import { ExchangeRatesPage } from '../../features/exchange-rates/presentation/ExchangeRatesPage';
import { CreateInvoicePage } from '../../features/invoices/presentation/CreateInvoicePage';
import { InvoiceReviewCheckoutPage } from '../../features/invoices/presentation/InvoiceReviewCheckoutPage';
import { InvoiceHistoryPage } from '../../features/invoices/presentation/InvoiceHistoryPage';
import { InvoiceDetailsPage } from '../../features/invoices/presentation/InvoiceDetailsPage';
import { TipsHistoryPage } from '../../features/tips/presentation/TipsHistoryPage';
import { DashboardPage } from '../../features/dashboard/presentation/DashboardPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        {appRoutes.filter(({ path }) => path !== '/dashboard' && path !== '/invoices/new' && path !== '/invoices' && path !== '/products' && path !== '/settings/exchange-rates' && path !== '/tips').map(({ path, label }) => (
          <Route key={path} path={path} element={<PlaceholderPage title={label} />} />
        ))}
        <Route path="/invoices/new" element={<CreateInvoicePage />} />
        <Route path="/invoices" element={<InvoiceHistoryPage />} />
        <Route path="/products" element={<ProductManagementPage />} />
        <Route path="/settings/exchange-rates" element={<ExchangeRatesPage />} />
        <Route path="/tips" element={<TipsHistoryPage />} />
        {featureRoutes.filter(({ path }) => path !== '/invoices/review' && path !== '/invoices/:invoiceId').map(({ path, title }) => (
          <Route key={path} path={path} element={<PlaceholderPage title={title} />} />
        ))}
        <Route path="/invoices/review" element={<InvoiceReviewCheckoutPage />} />
        <Route path="/invoices/:invoiceId" element={<InvoiceDetailsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  const location = useLocation();
  return <PlaceholderPage title={`Page not found: ${location.pathname}`} />;
}
