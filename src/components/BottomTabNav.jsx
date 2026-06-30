import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Ticket, BarChart2, Settings } from 'lucide-react';

const TABS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Tickets', href: '/tickets', icon: Ticket },
  { label: 'KPI', href: '/kpi', icon: BarChart2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function BottomTabNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleTabClick = (tab) => {
    if (location.pathname === tab.href) {
      // Already on this tab — scroll to top as a "reset"
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(tab.href);
    }
  };

  return null;
}