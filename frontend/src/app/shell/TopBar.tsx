import { matchPath, useLocation } from 'react-router-dom';
import { appRoutes, featureRoutes } from '../routes/routeConfig';

export function TopBar() {
  const { pathname } = useLocation();
  const current = [...appRoutes, ...featureRoutes].find((route) => matchPath({ path: route.path, end: true }, pathname));
  const title = current ? ('label' in current ? current.label : current.title) : 'Nile Villas';

  return (
    <header className="top-bar">
      <span className="top-bar__context">Nile Villas</span>
      <span className="top-bar__separator" aria-hidden="true">•</span>
      <span className="top-bar__page">{title}</span>
    </header>
  );
}
