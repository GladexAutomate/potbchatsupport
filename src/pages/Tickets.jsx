import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/db';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import StaffMessenger from '@/components/StaffMessenger';
import { usePolling } from '@/lib/usePolling';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

// Map role to department name as stored on the ticket
const ROLE_TO_DEPT = {
  it: 'IT',
  sales: 'Sales',
  accounting: 'Accounting',
  sign_ups: 'Sign-Ups',
  on_boarding: 'On-Boarding',
  corp_training: 'Corp/Training',
  tl_management: 'TL/Management',
};

export default function Tickets() {
  const { user } = useAuth();
  const location = useLocation();
  const [tickets, setTickets] = useState([]);
  const [vipEmails, setVipEmails] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(null);
  const autoOpenId = new URLSearchParams(location.search).get('open');

  // Server-side filter: only fetch what this user needs
  const loadTickets = async () => {
    if (!user) { setLoading(false); return; }
    const role = user.role;
    const isL1 = ['super_admin', 'admin', 'csr', 'tl_management'].includes(role);

    let data = [];
    if (isL1) {
      // L1: fetch all tickets, filter VIP client-side (SDK doesn't support boolean false filters)
      data = await db.Ticket.filter({}, '-created_date', 200);
    } else {
      // L2: fetch only tickets assigned to this user
      data = await db.Ticket.filter({ assigned_to: user.email }, '-created_date', 100);
    }

    // Load VIP emails for fallback check
    const vipList = await base44.entities.VIPCustomer.filter({});
    const vipEmailSet = new Set((vipList || []).map(v => v.email?.toLowerCase()));

    // Filter out VIP tickets — check both is_vip flag AND email match
    let result = (data || []).filter(t =>
      !t.is_vip && !vipEmailSet.has(t.customer_email?.toLowerCase())
    );
    if (!isL1) {
      const dept = ROLE_TO_DEPT[role];
      const extra = await db.Ticket.filter({}, '-created_date', 200);
      const deptTickets = (extra || []).filter(t =>
        !t.is_vip && (
          t.created_by_id === user.id ||
          (dept && (t.dept_sla_log || []).some(log => log.department === dept))
        )
      );
      const ids = new Set(result.map(t => t.id));
      deptTickets.forEach(t => { if (!ids.has(t.id)) result.push(t); });
    }

    setTickets(result);
    setLoading(false);
  };

  useEffect(() => {
    db.VIPCustomer.list().then(vips => {
      setVipEmails(new Set((vips || []).map(v => v.email?.toLowerCase())));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let loadTimer;
    loadTickets();
    // Debounced subscription — 1.5s buffer to reduce re-renders under high traffic
    const unsub = db.Ticket.subscribe(() => {
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => loadTickets(), 1500);
    });
    return () => { clearTimeout(loadTimer); unsub(); };
  }, [user]);

  // Realtime fallback: poll the ticket list in case the websocket is silent.
  usePolling(loadTickets, 8000, !!user);

  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = async (e) => {
    if (touchStartY.current === null) return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (diff > 80 && !refreshing) {
      setRefreshing(true);
      await loadTickets();
      setRefreshing(false);
    }
  };

  return (
    <div
      className="p-4 md:p-6 h-full"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold">Tickets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
        </div>
        {refreshing && (
          <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Refreshing...
          </div>
        )}
      </div>
      <StaffMessenger tickets={tickets} loading={loading} autoOpenTicketId={autoOpenId} />
    </div>
  );
}