import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, Ticket, BarChart2, Settings, MessageSquare,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Users,
  MessageSquareText, Tag, Star, MessagesSquare, Crown, UserCheck, Shield, Lock, Send, FolderOpen, Clock, Bell
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatMonthDay } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import BottomTabNav from '@/components/BottomTabNav';


const STAFF_ROLES = ['super_admin', 'admin', 'csr', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'tl_management'];

// All nav items — organized by function and visibility driven by Permission entity
const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, pageKey: 'dashboard' },
  
  // Customer Operations
  { label: 'Customer Operations', href: '#customer-ops', icon: FolderOpen, pageKey: 'customer-operations', children: [
    { label: 'All Tickets', href: '/tickets', icon: Ticket, pageKey: 'tickets', ticketBadge: true },
    { label: 'VIP Tickets', href: '/vip-tickets', icon: Crown, pageKey: 'vip-tickets', ticketBadge: true },
    { label: 'Escalations', href: '/escalations', icon: Crown, pageKey: 'escalations' },
    { label: 'Group Chat', href: '/group-chat', icon: MessagesSquare, pageKey: 'group-chat', badge: true },
  ]},

  // Internal Operations
  { label: 'Internal Operations', href: '#internal-ops', icon: Send, pageKey: 'internal-operations', children: [
    { label: 'Internal Tickets', href: '/internal-tickets', icon: Send, pageKey: 'internal-tickets', internalBadge: true },
  ]},
  
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
  const [ticketUnread, setTicketUnread] = useState(0);
  const [internalTicketUnread, setInternalTicketUnread] = useState(0);
  const [permissions, setPermissions] = useState([]);
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || 'customer';
  const isSuperAdmin = role === 'super_admin';

  // Auto dark mode detection based on system preference
  useEffect(() => {
    const applyDark = (e) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    document.documentElement.classList.toggle('dark', mq.matches);
    mq.addEventListener('change', applyDark);
    return () => mq.removeEventListener('change', applyDark);
  }, []);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { count: notifCount, items: notifItems, markAllRead } = useNotifications(user);
  const [notifPage, setNotifPage] = useState(0);
  const notifRef = useRef(null);
  
  const NOTIF_PER_PAGE = 10;
  const notifToShow = notifItems.slice(0, (notifPage + 1) * NOTIF_PER_PAGE);
  const hasMore = notifItems.length > notifToShow.length;
  
  const formatNotifTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      // Relative age is just an instant diff (timezone-independent). Only the
      // >7-day fallback needs a date, which we render in the app timezone.
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      return formatMonthDay(dateStr);
    } catch {
      return '';
    }
  };

  const PATH_TO_PAGE_KEY = {
    '/dashboard': 'dashboard',
    '/tickets': 'tickets',
    '/vip-tickets': 'vip-tickets',
    '/escalations': 'escalations',
    '/group-chat': 'group-chat',
    '/kpi': 'kpi',
    '/staff-ratings': 'staff-ratings',
    '/users': 'users',
    '/customers': 'customers',
    '/role-permissions': 'manage-roles',
    '/sla-settings': 'sla-settings',
    '/test-accounts': 'test-accounts',
    '/chatbot-config': 'chatbot-config',
    '/replying-center': 'replying-center',
    '/conversation-tags': 'conversation-tags',
    '/internal-tickets': 'internal-tickets',
  };



  // Track unread group chat messages — last-seen timestamp + realtime, mirroring the
  // ticket badges. Location-aware so that viewing the chat reliably clears the badge
  // (and keeps it cleared) instead of a stale count sticking around.
  useEffect(() => {
    if (!user) return;
    const SEEN_KEY = `group_chat_seen_${user.email}`;
    const getLastSeen = () => parseInt(localStorage.getItem(SEEN_KEY) || '0', 10);
    const setLastSeen = (ts) => localStorage.setItem(SEEN_KEY, String(ts));

    // On the group chat page: mark everything seen and hold the badge at 0, even as
    // new messages stream in while the user is reading.
    if (location.pathname === '/group-chat') {
      setLastSeen(Date.now());
      setGroupChatUnread(0);
      const unsub = db.GroupChatMessage.subscribe((event) => {
        if (event.type === 'create') setLastSeen(Date.now());
      });
      return () => unsub();
    }

    const computeUnread = async () => {
      const lastSeen = getLastSeen();
      const msgs = await db.GroupChatMessage.list('-created_date', 100);
      const count = (msgs || []).filter(m =>
        m.sender_email !== user.email && new Date(m.created_date).getTime() > lastSeen
      ).length;
      setGroupChatUnread(count);
    };
    computeUnread();
    const unsub = db.GroupChatMessage.subscribe((event) => {
      if (event.type !== 'create') return;
      if (event.data?.sender_email === user.email) return;
      setGroupChatUnread(prev => prev + 1);
    });
    return () => unsub();
  }, [user, location.pathname]);

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
        setPermissionsLoaded(true);
      } catch (e) {
        console.error('[Layout] Failed to load permissions:', e);
        setPermissions([]);
        setPermissionsLoaded(true);
      }
    };
    loadPerms();

    // Re-load when permissions change (so sidebar and guards update live)
    const unsub = db.Permission.subscribe(() => loadPerms());
    return () => unsub();
  }, [user, role, isSuperAdmin]);

  // Clear ticket badges when on their pages (group chat is handled in its own effect)
  useEffect(() => {
    if (location.pathname === '/tickets' || location.pathname === '/vip-tickets') {
      setTicketUnread(0);
    }
    if (location.pathname === '/internal-tickets') {
      setInternalTicketUnread(0);
    }
  }, [location.pathname]);

  // Track unread ticket messages for tickets assigned to this user
  useEffect(() => {
    if (!user) return;
    const SEEN_KEY = `ticket_msg_seen_${user.email}`;
    const getLastSeen = () => parseInt(localStorage.getItem(SEEN_KEY) || '0', 10);
    const setLastSeen = (ts) => localStorage.setItem(SEEN_KEY, String(ts));

    const computeUnread = async () => {
      const lastSeen = getLastSeen();
      // Get recent ticket messages newer than last seen
      const recentMsgs = await db.TicketMessage.filter({}, '-created_date', 50);
      const newMsgs = (recentMsgs || []).filter(m => {
        if (m.sender_email === user.email) return false; // own messages
        const msgTime = new Date(m.created_date).getTime();
        return msgTime > lastSeen;
      });
      if (newMsgs.length === 0) return;
      // Check if any belong to tickets assigned to this user
      const ticketIds = [...new Set(newMsgs.map(m => m.ticket_id))];
      const tickets = await Promise.all(ticketIds.map(id => db.Ticket.get(id)));
      const relevant = tickets.filter(t => t && t.assigned_to === user.email);
      if (relevant.length > 0 && (location.pathname !== '/tickets' && location.pathname !== '/vip-tickets')) {
        setTicketUnread(prev => prev + newMsgs.filter(m => relevant.some(t => t.id === m.ticket_id)).length);
      }
    };

    // Update lastSeen when on tickets pages
    if (location.pathname === '/tickets' || location.pathname === '/vip-tickets') {
      setLastSeen(Date.now());
    }

    computeUnread();
    const unsub = db.TicketMessage.subscribe((event) => {
      if (event.type !== 'create') return;
      if (event.data?.sender_email === user.email) return;
      if (location.pathname === '/tickets' || location.pathname === '/vip-tickets') {
        setLastSeen(Date.now());
        return;
      }
      // Check if this message belongs to an assigned ticket
      db.Ticket.get(event.data?.ticket_id).then(ticket => {
        if (ticket && ticket.assigned_to === user.email) {
          setTicketUnread(prev => prev + 1);
        }
      }).catch(() => {});
    });
    return () => unsub();
  }, [user, location.pathname]);

  // Track new internal tickets assigned to this user's department
  useEffect(() => {
    if (!user) return;
    const ROLE_TO_DEPT = {
      csr: 'CSR', sales: 'Sales', it: 'IT', accounting: 'Accounting',
      sign_ups: 'Sign-Ups', on_boarding: 'On-Boarding', corp_training: 'Corp/Training',
      admin: 'Admin', tl_management: 'TL/Management',
    };
    const userDept = ROLE_TO_DEPT[role] ?? null;
    const SEEN_KEY = `internal_ticket_seen_${user.email}`;
    const getLastSeen = () => parseInt(localStorage.getItem(SEEN_KEY) || '0', 10);
    const setLastSeen = (ts) => localStorage.setItem(SEEN_KEY, String(ts));

    if (location.pathname === '/internal-tickets') {
      setLastSeen(Date.now());
      return;
    }

    const computeUnread = async () => {
      const lastSeen = getLastSeen();
      const recent = await db.InternalTicket.filter({}, '-created_date', 50);
      const newTickets = (recent || []).filter(t => {
        const ts = new Date(t.created_date).getTime();
        if (ts <= lastSeen) return false;
        if (t.created_by_email === user.email) return false; // own tickets
        // super_admin/tl_management see all; others check dept
        if (role === 'super_admin' || role === 'tl_management') return true;
        return userDept && t.to_department === userDept;
      });
      if (newTickets.length > 0) setInternalTicketUnread(newTickets.length);
    };

    computeUnread();
    const unsub = db.InternalTicket.subscribe((event) => {
      if (event.type !== 'create') return;
      if (location.pathname === '/internal-tickets') { setLastSeen(Date.now()); return; }
      if (event.data?.created_by_email === user.email) return;
      const toDept = event.data?.to_department;
      const isRelevant = role === 'super_admin' || role === 'tl_management'
        || (userDept && toDept === userDept);
      if (isRelevant) setInternalTicketUnread(prev => prev + 1);
    });
    return () => unsub();
  }, [user, role, location.pathname]);

  // Only staff roles can access the staff portal — redirect everyone else
  useEffect(() => {
    if (user && !STAFF_ROLES.includes(role)) {
      navigate('/');
    }
  }, [user, role]);

  // Enforce page-level permission blocking — redirect if current page is blocked
  useEffect(() => {
    if (!permissionsLoaded || isSuperAdmin || !user) return;
    const pageKey = PATH_TO_PAGE_KEY[location.pathname];
    if (pageKey && !hasPageAccess(pageKey)) {
      // Find first accessible page to redirect to
      const orderedPaths = Object.entries(PATH_TO_PAGE_KEY);
      const firstAccessible = orderedPaths.find(([, key]) => hasPageAccess(key));
      navigate(firstAccessible ? firstAccessible[0] : '/', { replace: true });
    }
  }, [location.pathname, permissions, permissionsLoaded]);

  const hasPageAccess = (pageKey) => {
    if (isSuperAdmin) return true;
    // Parent categories are visible if at least one child page has access
    const parentKeys = ['customer-operations', 'internal-operations', 'analytics', 'administration', 'settings'];
    if (parentKeys.includes(pageKey)) return true;
    if (!permissionsLoaded) return false;
    const perm = permissions.find(p => p.resource_name === pageKey);
    return perm?.has_access === true;
  };

  const navItemsWithChildren = navItems;

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
  const internalOpsOpen = location.pathname === '/internal-tickets';
  const analyticsOpen = ['/kpi', '/staff-ratings'].includes(location.pathname);
  const adminOpen = ['/users', '/customers', '/role-permissions'].includes(location.pathname);

  const [settingsExpanded, setSettingsExpanded] = useState(settingsOpen);
  const [customerOpsExpanded, setCustomerOpsExpanded] = useState(customerOpsOpen);
  const [internalOpsExpanded, setInternalOpsExpanded] = useState(internalOpsOpen);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(analyticsOpen);
  const [adminExpanded, setAdminExpanded] = useState(adminOpen);
  const navScrollRef = useRef(null);

  const handleCategoryToggle = (setter, currentState) => {
    // Preserve scroll position when toggling
    if (navScrollRef.current) {
      const scrollPos = navScrollRef.current.scrollTop;
      setter(v => !v);
      // Restore scroll after state updates
      setTimeout(() => {
        if (navScrollRef.current) navScrollRef.current.scrollTop = scrollPos;
      }, 0);
    } else {
      setter(v => !v);
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-sidebar-border select-none", isCollapsed && "justify-center px-2")} style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
        <img
          src="https://media.base44.com/images/public/6a0c352fa1dbbd33554db2fb/ed813df70_POTBlogo.jpg"
          alt="POTB Logo"
          className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
        />
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-sora font-semibold text-sm text-white leading-tight">Pinoy Online Travel Biz</p>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-sidebar-foreground/60">Support Hub</p>
              <div className="relative">
                <button
                 onClick={() => { setNotifOpen(v => !v); if (!notifOpen) setNotifPage(0); }}
                 className="relative text-sidebar-foreground/60 hover:text-white transition-colors select-none"
                 title="Notifications"
                >
                  <Bell className={`w-3.5 h-3.5 ${notifCount > 0 ? 'text-red-400 animate-pulse' : ''}`} />
                  {notifCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute left-0 top-6 z-50 w-96 bg-popover border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[600px]">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-popover">
                      <span className="text-sm font-bold text-foreground">Notifications</span>
                      <button onClick={() => { setNotifOpen(false); markAllRead(); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                      {notifItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No new notifications</p>
                      ) : (
                        <div>
                          {[...notifToShow].reverse().map((n, i) => (
                            <button
                              key={i}
                              onClick={async () => {
                                setNotifOpen(false);
                                await db.Notification.update(n.id, { is_read: true });
                                if (n.redirect_url) {
                                  navigate(n.redirect_url);
                                }
                              }}
                              className="w-full text-left px-4 py-3 border-b border-border/30 hover:bg-muted/40 transition-colors cursor-pointer group"
                            >
                              <div className="flex gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center text-primary font-semibold text-sm">
                                  {n.message.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground leading-snug break-words">{n.message}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{formatNotifTime(n.created_date)}</p>
                                </div>
                                {!n.is_read && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 mt-2"></div>}
                              </div>
                            </button>
                          ))}
                          {hasMore && (
                            <button
                              onClick={() => setNotifPage(p => p + 1)}
                              className="w-full px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted/50 transition-colors border-t border-border/30"
                            >
                              Show More
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <nav ref={navScrollRef} className="flex-1 py-4 px-2 space-y-1 overflow-x-hidden overflow-y-auto">
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
                    if (item.pageKey === 'settings') handleCategoryToggle(setSettingsExpanded);
                    if (item.pageKey === 'customer-operations') handleCategoryToggle(setCustomerOpsExpanded);
                    if (item.pageKey === 'internal-operations') handleCategoryToggle(setInternalOpsExpanded);
                    if (item.pageKey === 'analytics') handleCategoryToggle(setAnalyticsExpanded);
                    if (item.pageKey === 'administration') handleCategoryToggle(setAdminExpanded);
                  }}
                 className={cn(
                   "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium select-none",
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
                      const tktBadge = child.ticketBadge && ticketUnread > 0 ? ticketUnread : 0;
                      const intBadge = child.internalBadge && internalTicketUnread > 0 ? internalTicketUnread : 0;
                      const anyBadge = unreadBadge || tktBadge || intBadge;
                      return (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium relative select-none",
                            childActive
                              ? "bg-primary text-white shadow-lg shadow-primary/30"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                            (tktBadge > 0 || intBadge > 0) && !childActive && "shadow-[0_0_8px_2px_rgba(239,68,68,0.4)]"
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <child.icon className="w-4 h-4" />
                            {anyBadge > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                {anyBadge > 9 ? '9+' : anyBadge}
                              </span>
                            )}
                          </div>
                          <span className="flex-1">{child.label}</span>
                          {anyBadge > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                              {anyBadge > 9 ? '9+' : anyBadge}
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

      <div className={cn("p-3 border-t border-sidebar-border", isCollapsed && "flex flex-col items-center gap-2")}>
        {isCollapsed && notifCount > 0 && (
          <button onClick={() => { setNotifOpen(v => !v); if (!notifOpen) setNotifPage(0); }} className="relative text-sidebar-foreground hover:text-white mb-1">
            <Bell className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          </button>
        )}
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
    <div className="flex h-screen bg-background overflow-hidden relative">
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

      {/* Mobile Sidebar drawer - hidden on mobile since we use BottomTabNav */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-56 flex flex-col" style={{ background: 'hsl(var(--sidebar-background))' }}>
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Mobile Bottom Tab Navigation */}
      <BottomTabNav />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden z-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 px-4 bg-card border-b border-border select-none" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: '0.75rem' }}>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="select-none min-h-[44px] min-w-[44px]">
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-sora font-semibold text-sm">Pinoy Online Travel Biz</span>
        </header>

        <main className="flex-1 overflow-auto pb-safe" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {!isSuperAdmin && !permissionsLoaded ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}