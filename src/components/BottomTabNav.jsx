import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Ticket, BarChart2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Tickets', href: '/tickets', icon: Ticket },
  { label: 'KPI', href: '/kpi', icon: BarChart2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function BottomTabNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-sidebar border-t border-sidebar-border flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map(tab => {
        const active = location.pathname === tab.href;
        return (
          <Link
            key={tab.href}
            to={tab.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] select-none transition-colors',
              active ? 'text-sidebar-primary' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
            )}
          >
            <tab.icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}