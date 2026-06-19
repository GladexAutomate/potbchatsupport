import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { getAppEnv } from '@/lib/appEnv';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, Ticket, BarChart2, Settings, MessageSquare,
  ChevronLeft, ChevronRight, LogOut, Menu, X, ShieldCheck, Users,
  MessageSquareText, Tag, Star, MessagesSquare, Crown, UserCheck, Shield, Lock, Send, FolderOpen, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STAFF_ROLES = ['super_admin', 'admin', 'csr', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'tl_management'];

// All nav items — organized by function and visibility driven by Permission entity
const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, pageKey: 'dashboard' },
  
  // Customer Operations
  { label: 'Customer Operations', href: '#customer-ops', icon: FolderOpen, pageKey: 'customer-operations', children: [
    { label: 'All Tickets', href: '/tickets', icon: Ticket, pageKey: 'tickets' },
    { label: 'VIP Tickets', href: '/vip-tickets', icon: Crown, pageKey: 'vip-tickets' },
    { label: 'Escalations', href: '/escalations', icon: Crown, pageKey: 'escalations' },
    { label: 'Group Chat', href: '/group-chat', icon: MessagesSquare, pageKey: 'group-chat', badge: true },
  ]},

  // Internal Operations
  { label: 'Internal Operations', href: '#internal-ops', icon: Send, pageKey: 'internal-operations', children: [] }, // Children added dynamically
  
  // Analytics & Performance
  { label: 'Analytics & Performance', href: '#analytics', icon: BarChart2, pageKey: 'analytics', children: [
    { label: 'KPI & SLA', href: '/kpi', icon: BarChart2, pageKey: 'kpi' },
    { label: 'Staff Ratings', href: '/staff-ratings', icon: Star, pageKey: 'staff-ratings' },
  ]},
  
  // Administration
  { label: 'Administration', href: '#admin', icon: Shield, pageKey: 'administration', children: [
    { label: 'User Management', href: '/users', icon: Users, pageKey: 'users' },
    { label: 'Customers', href: '/customers', icon: UserCheck, pageKey: 'customers' },
    { label: 'Role Permissions', href: '/role-permissions', icon: Lock, pageKey: 'manage-roles' },
  ]},
  
  // System Settings
  { label: 'Settings', href: '#settings', icon: Settings, pageKey: 'settings', children: [
    { label: 'SLA Policies', href: '/sla-settings', icon: Clock, pageKey: 'sla-settings' },
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
    db.GroupChatMessage.list('created_date', 100).then(computeUnread);
    const unsub = db.GroupChatMessage.subscribe(() => {
      db.GroupChatMessage.list('created_date', 100).then(computeUnread);
    });
    return () => unsub();
  }, [user]);

  // Load permissions for this role — ignore env so permissions sync across test/prod
  useEffect(() => {
    console.log('[Layout] Permission effect triggered. User:', user?.email, 'Role:', role, 'IsSuperAdmin:', isSuperAdmin);
    if (!user) {
      console.log('[Layout] No user, skipping');
      return;
    }
    if (isSuperAdmin) {
      console.log('[Layout] Super admin, setting empty perms');
      setPermissions([]);
      return;
    }
    const loadPerms = async () => {
      try {
        console.log('[Layout] Loading permissions for role:', role);
        const allPerms = await db.Permission.list(null, 500);
        console.log('[Layout] Total permissions loaded:', allPerms?.length);
        if (allPerms && allPerms.length > 0) {
          console.log('[Layout] First permission structure:', JSON.stringify(allPerms[0], null, 2));
        }
        const rolePerms = (allPerms || []).filter(p => {
          console.log('[Layout] Checking perm - role:', p.role, 'resourceType:', p.resource_type, 'matches:', p.role === role && p.resource_type === 'page');
          return p.role === role && p.resource_type === 'page';
        });
        console.log(`[Layout] Filtered to ${rolePerms?.length} permissions for role '${role}'`, rolePerms?.map(p => p.resource_name));
        setPermissions(rolePerms);
      } catch (e) {
        console.error('[Layout] Failed to load permissions:', e);
        setPermissions([]);
      }
    };
    loadPerms();
  }, [user, role, isSuperAdmin]);

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
     // Parent categories (like 'settings', 'customer-operations') don't have explicit permissions
     // They're always visible if at least one child has access
     const parentKeys = ['customer-operations', 'internal-operations', 'analytics', 'administration', 'settings'];
     if (parentKeys.includes(pageKey)) return true;
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

  // Map internal ticket page keys to their routes
  const internalPageKeys = {
    'internal-tickets-sales': { label: 'Sales Tickets', route: '/internal-tickets-sales' },
    'internal-tickets-it': { label: 'IT Tickets', route: '/internal-tickets-it' },
    'internal-tickets-accounting': { label: 'Accounting Tickets', route: '/internal-tickets-accounting' },
    'internal-tickets-signups': { label: 'Sign-Ups Tickets', route: '/internal-tickets-signups' },
    'internal-tickets-onboarding': { label: 'On-Boarding Tickets', route: '/internal-tickets-onboarding' },
    'internal-tickets-corptraining': { label: 'Corp/Training Tickets', route: '/internal-tickets-corptraining' },
    'internal-tickets-admin': { label: 'Internal Tickets Admin', route: '/internal-tickets-admin' },
  };

  // Build internal tickets nav before filtering
  const internalOperationsChildren = (() => {
    const children = [];
    Object.entries(internalPageKeys).forEach(([pageKey, data]) => {
      if (hasPageAccess(pageKey)) {
        children.push({
          label: data.label,
          href: data.route,
          icon: Send,
          pageKey: pageKey
        });
      }
    });
    return children;
  })();

  // Update navItems with built children
  const navItemsWithChildren = navItems.map(item => 
    item.pageKey === 'internal-operations' 
      ? { ...item, children: internalOperationsChildren }
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
  const customerOpsOpen = ['/tickets', '/vip-tickets', '/escalations', '/group-chat'].includes(location.pathname);
  const internalOpsOpen = ['/internal-tickets-sales', '/internal-tickets-it', '/internal-tickets-accounting', '/internal-tickets-signups', '/internal-tickets-onboarding', '/internal-tickets-corptraining'].includes(location.pathname);
  const analyticsOpen = ['/kpi', '/staff-ratings'].includes(location.pathname);
  const adminOpen = ['/users', '/customers', '/role-permissions'].includes(location.pathname);

  const [settingsExpanded, setSettingsExpanded] = useState(settingsOpen);
  const [customerOpsExpanded, setCustomerOpsExpanded] = useState(customerOpsOpen);
  const [internalOpsExpanded, setInternalOpsExpanded] = useState(internalOpsOpen);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(analyticsOpen);
  const [adminExpanded, setAdminExpanded] = useState(adminOpen);

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
            const isCustomerOpsMenu = item.pageKey === 'customer-operations';
            const isInternalOpsMenu = item.pageKey === 'internal-operations';
            const isAnalyticsMenu = item.pageKey === 'analytics';
            const isAdminMenu = item.pageKey === 'administration';
            const anyChildActive = item.children.some(c => location.pathname === c.href);
            const expanded = (isSettingsMenu && settingsExpanded) || (isCustomerOpsMenu && customerOpsExpanded) || (isInternalOpsMenu && internalOpsExpanded) || (isAnalyticsMenu && analyticsExpanded) || (isAdminMenu && adminExpanded) || anyChildActive;
            return (
              <div key={item.href}>
                <button
                  onClick={() => {
                    if (item.pageKey === 'settings') setSettingsExpanded(v => !v);
                    if (item.pageKey === 'customer-operations') setCustomerOpsExpanded(v => !v);
                    if (item.pageKey === 'internal-operations') setInternalOpsExpanded(v => !v);
                    if (item.pageKey === 'analytics') setAnalyticsExpanded(v => !v);
                    if (item.pageKey === 'administration') setAdminExpanded(v => !v);
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
                      const unreadBadge = child.badge && groupChatUnread > 0 ? groupChatUnread : 0;
                      return (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium relative",
                            childActive
                              ? "bg-primary text-white shadow-lg shadow-primary/30"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <child.icon className="w-4 h-4" />
                            {unreadBadge > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                {unreadBadge > 9 ? '9+' : unreadBadge}
                              </span>
                            )}
                          </div>
                          <span className="flex-1">{child.label}</span>
                          {unreadBadge > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                              {unreadBadge > 9 ? '9+' : unreadBadge}
                            </span>
                          )}
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