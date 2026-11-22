import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import './shell.css';

export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <TopBar />
        <main className="app-shell__content"><Outlet /></main>
      </div>
    </div>
  );
}
