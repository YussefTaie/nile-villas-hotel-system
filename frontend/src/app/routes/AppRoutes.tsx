import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { appRoutes, featureRoutes } from './routeConfig';
import { PlaceholderPage } from './PlaceholderPage';
import { ProductManagementPage } from '../../features/catalog/presentation/ProductManagementPage';
import { ExchangeRatesPage } from '../../features/exchange-rates/presentation/ExchangeRatesPage';
import { CreateInvoicePage } from '../../features/invoices/presentation/CreateInvoicePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {appRoutes.filter(({ path }) => path !== '/invoices/new' && path !== '/products' && path !== '/settings/exchange-rates').map(({ path, label }) => (
          <Route key={path} path={path} element={<PlaceholderPage title={label} />} />
        ))}
        <Route path="/invoices/new" element={<CreateInvoicePage />} />
        <Route path="/products" element={<ProductManagementPage />} />
        <Route path="/settings/exchange-rates" element={<ExchangeRatesPage />} />
        {featureRoutes.map(({ path, title }) => (
          <Route key={path} path={path} element={<PlaceholderPage title={title} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  const location = useLocation();
  return <PlaceholderPage title={`Page not found: ${location.pathname}`} />;
}
