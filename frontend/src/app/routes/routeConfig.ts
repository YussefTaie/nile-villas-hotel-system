export const appRoutes = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/invoices/new', label: 'Create Invoice', icon: 'receipt_long' },
  { path: '/invoices', label: 'Invoice History', icon: 'history' },
  { path: '/products', label: 'Products', icon: 'restaurant_menu' },
  { path: '/settings/exchange-rates', label: 'Settings', icon: 'settings' },
  { path: '/tips', label: 'Tips History', icon: 'payments' },
] as const;

export const featureRoutes = [
  { path: '/invoices/review', title: 'Invoice Review & Checkout' },
  { path: '/invoices/:invoiceId', title: 'Invoice Details' },
] as const;
