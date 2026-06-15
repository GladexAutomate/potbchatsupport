import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, Ticket, BarChart2, Settings, MessageSquare,
  ChevronLeft, ChevronRight, LogOut, Menu, X, ShieldCheck, Users,
  MessageSquareText, Tag, Star, MessagesSquare, Crown, UserCheck, Shield, Lock, Send, FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STAFF_ROLES = ['super_admin', 'admin', 'csr', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'tl_management'];

// All nav items — organized by function and visibility driven by Permission entity
const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, pageKey: 'dashboard' },
  
  // Customer Operations
  { label: 'Customer Tickets', href: '#tickets', icon: FolderOpen, pageKey: 'customer-tickets', children: [
    { label: 'All Tickets', href: '/tickets', icon: Ticket, pageKey: 'tickets' },
    { label: 'VIP Tickets', href: '/vip-tickets', icon: Crown, pageKey: 'vip-tickets' },
  ]},
  { label: 'Group Chat', href: '/group-chat', icon: MessagesSquare, pageKey: 'group-chat', badge: true },
  { label: 'Internal Tickets', href: '#internal', icon: Send, pageKey: 'internal-tickets', children: [] }, // Children added dynamically
  
  // Analytics & Performance
  { label: 'KPI & SLA', href: '/kpi', icon: BarChart2, pageKey: 'kpi' },
  { label: 'Staff Ratings', href: '/staff-ratings', icon: Star, pageKey: 'staff-ratings' },
  
  // Administration
  { label: 'User Management', href: '/users', icon: Users, pageKey: 'users' },
  { label: 'Customers', href: '/customers', icon: UserCheck, pageKey: 'customers' },
  { label: 'Role Permissions', href: '/role-permissions', icon: Lock, pageKey: 'manage-roles' },
  
  // System Settings
  { label: 'Settings', href: '/settings', icon: Settings, pageKey: 'settings', children: [
    { label: 'SLA Settings', href: '/settings', icon: Settings, pageKey: 'settings' },
    { label: 'Test Accounts', href: '/test-accounts', icon: Shield, pageKey: 'test-accounts' },
    { label: 'Chatbot Config', href: '/chatbot-config', icon: MessageSquare, pageKey: 'chatbot-config' },
    { label: 'Replying Center', href: '/replying-center', icon: MessageSquareText, pageKey: 'replying-center' },
    { label: 'Conversation Tags', href: '/conversation-tags', icon: Tag, pageKey: 'conversation-tags' },
  ]},
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [hoverCollapsed, setHoverCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [groupChatUnread, setGroupChatUnread] = useState(0);
  const [permissions, setPermissions] = useState([]);
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || 'customer';
  const isSuperAdmin = role === 'super_admin';

  useEffect(() => {
    if (!user) return;
    const computeUnread = (msgs) => {
      const count = (msgs || []).filter(m => !m.read_by?.includes(user.email)).length;
      setGroupChatUnread(count);
    };
    base44.entities.GroupChatMessage.list('created_date', 100).then(computeUnread);
    const unsub = base44.entities.GroupChatMessage.subscribe(() => {
      base44.entities.GroupChatMessage.list('created_date', 100).then(computeUnread);
    });
    return () => unsub();
  }, [user]);

  // Load permissions for this role
  useEffect(() => {
    if (!user || isSuperAdmin) return;
    base44.entities.Permission.filter({ role, resource_type: 'page' }).then(setPermissions).catch(() => {});
  }, [user, role]);

  // Clear badge when on group chat page
  useEffect(() => {
    if (location.pathname === '/group-chat') {
      setGroupChatUnread(0);
    }
  }, [location.pathname]);

  // Only staff roles can access the staff portal — redirect everyone else
  useEffect(() => {
    if (user && !STAFF_ROLES.includes(role)) {
      navigate('/');
    }
  }, [user, role]);

  const hasPageAccess = (pageKey) => {
    if (isSuperAdmin) return true;
    const perm = permissions.find(p => p.resource_name === pageKey);
    return perm?.has_access === true;
  };

  // Map user roles to their internal ticket pages
  const departmentRoutes = {
    'sales': '/internal-tickets-sales',
    'it': '/internal-tickets-it',
    'accounting': '/internal-tickets-accounting',
    'sign_ups': '/internal-tickets-signups',
    'on_boarding': '/internal-tickets-onboarding',
    'corp_training': '/internal-tickets-corptraining',
  };

  const departmentLabels = {
    'sales': 'Sales',
    'it': 'IT',
    'accounting': 'Accounting',
    'sign_ups': 'Sign-Ups',
    'on_boarding': 'On-Boarding',
    'corp_training': 'Corp/Training',
  };

  // Build internal tickets nav before filtering
  const internalTicketsChildren = (() => {
    const children = [];
    if (departmentRoutes[role]) {
      children.push({
        label: `My ${departmentLabels[role]} Tickets`,
        href: departmentRoutes[role],
        icon: Send,
        pageKey: `internal-${role}`
      });
    }
    // Admins see all department tickets
    if (role === 'super_admin' || role === 'admin') {
      Object.entries(departmentRoutes).forEach(([dept, route]) => {
        children.push({
          label: `${departmentLabels[dept]} Tickets`,
          href: route,
          icon: Send,
          pageKey: `internal-${dept}`
        });
      });
    }
    if (role === 'tl_management' || role === 'super_admin' || role === 'admin') {
      children.push({
        label: 'Escalations',
        href: '/internal-escalations',
        icon: Crown,
        pageKey: 'internal-escalations'
      });
    }
    return children;
  })();

  // Update navItems with built children
  const navItemsWithChildren = navItems.map(item => 
    item.pageKey === 'internal-tickets' 
      ? { ...item, children: internalTicketsChildren }
      : item
  );

  const filtered = navItemsWithChildren
    .filter(n => hasPageAccess(n.pageKey))
    .map(n => n.children
      ? { ...n, children: n.children.filter(c => hasPageAccess(c.pageKey)) }
      : n
    )
    .filter(n => !n.children || n.children.length > 0);

  const handleLogout = () => base44.auth.logout('/');

  const isCollapsed = collapsed && !hoverCollapsed;

  const settingsOpen = ['/settings', '/test-accounts', '/chatbot-config', '/replying-center', '/conversation-tags'].includes(location.pathname);
  const customerTicketsOpen = ['/tickets', '/vip-tickets'].includes(location.pathname);
  const [settingsExpanded, setSettingsExpanded] = useState(settingsOpen);
  const [customerTicketsExpanded, setCustomerTicketsExpanded] = useState(customerTicketsOpen);
  const [internalTicketsExpanded, setInternalTicketsExpanded] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-sidebar-border", isCollapsed && "justify-center px-2")}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        {!isCollapsed && (
          <div>
            <p className="font-sora font-semibold text-sm text-white leading-tight">LakbayHub</p>
            <p className="text-xs text-sidebar-foreground/60">Support Hub</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {filtered.map((item) => {
          const active = location.pathname === item.href;
          if (item.children) {
            const isSettingsMenu = item.pageKey === 'settings';
            const isCustomerTicketsMenu = item.pageKey === 'customer-tickets';
            const isInternalMenu = item.pageKey === 'internal-tickets';
            const anyChildActive = item.children.some(c => location.pathname === c.href);
            const expanded = (isSettingsMenu && settingsExpanded) || (isCustomerTicketsMenu && customerTicketsExpanded) || (isInternalMenu && internalTicketsExpanded) || anyChildActive;
            return (
              <div key={item.href}>
                <button
                  onClick={() => {
                    if (item.pageKey === 'settings') setSettingsExpanded(v => !v);
                    if (item.pageKey === 'customer-tickets') setCustomerTicketsExpanded(v => !v);
                    if (item.pageKey === 'internal-tickets') setInternalTicketsExpanded(v => !v);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
                    isCollapsed && "justify-center px-2",
                    (active || anyChildActive)
                      ? "bg-primary text-white shadow-lg shadow-primary/30"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
                    </>
                  )}
                </button>
                {expanded && !isCollapsed && (
                  <div className="ml-3 mt-1 space-y-1 border-l border-sidebar-border pl-2">
                    {item.children.map(child => {
                      const childActive = location.pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium",
                            childActive
                              ? "bg-primary text-white shadow-lg shadow-primary/30"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                          )}
                        >
                          <child.icon className="w-4 h-4 flex-shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          const unreadBadge = item.badge && groupChatUnread > 0 ? groupChatUnread : 0;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium relative",
                isCollapsed && "justify-center px-2",
                active
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <div className="relative flex-shrink-0">
                <item.icon className="w-4 h-4" />
                {unreadBadge > 0 && isCollapsed && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadBadge > 9 ? '9+' : unreadBadge}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {unreadBadge > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                      {unreadBadge > 9 ? '9+' : unreadBadge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn("p-3 border-t border-sidebar-border", isCollapsed && "flex justify-center")}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs text-primary font-semibold">{user?.full_name?.[0] || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{role}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "sm"}
          onClick={handleLogout}
          className="w-full text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar transition-all duration-300 flex-shrink-0 relative",
          (collapsed && !hoverCollapsed) ? "w-16" : "w-56"
        )}
        style={{ background: 'hsl(var(--sidebar-background))' }}
        onMouseEnter={() => { if (collapsed) setHoverCollapsed(true); }}
        onMouseLeave={() => { if (collapsed) setHoverCollapsed(false); }}
      >
        <SidebarContent />
        <button
          onClick={() => { setCollapsed(!collapsed); setHoverCollapsed(false); }}
          className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-full w-5 h-10 bg-sidebar-border rounded-r-lg flex items-center justify-center text-sidebar-foreground hover:bg-primary hover:text-white transition-colors z-10"
        >
          {(collapsed && !hoverCollapsed) ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-56 flex flex-col" style={{ background: 'hsl(var(--sidebar-background))' }}>
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-sora font-semibold text-sm">LakbayHub Support</span>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}