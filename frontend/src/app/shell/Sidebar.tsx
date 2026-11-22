import { NavLink, useLocation } from 'react-router-dom';
import { appRoutes } from '../routes/routeConfig';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';

export function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar__top">
        <NavLink className="sidebar__brand" to="/dashboard">Nile Villas</NavLink>
        <NavLink className="sidebar__new-invoice" to="/invoices/new">
          <Button variant="primary" fullWidth>
            <Icon name="add" />
            New Invoice
          </Button>
        </NavLink>
        <nav className="sidebar__nav">
          {appRoutes.map(({ path, label, icon }) => (
            <NavLink
              className={({ isActive }) => {
                const invoiceDetail = path === '/invoices' && pathname.startsWith('/invoices/') && pathname !== '/invoices/new';
                return `sidebar__link${isActive || invoiceDetail ? ' sidebar__link--active' : ''}`;
              }}
              key={path}
              to={path}
              end={path === '/invoices'}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
