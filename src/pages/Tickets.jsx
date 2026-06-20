import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import StaffMessenger from '@/components/StaffMessenger';
import { useLocation } from 'react-router-dom';

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
  const autoOpenId = new URLSearchParams(location.search).get('open');

  // Server-side filter: only fetch what this user needs
  const loadTickets = async () => {
    if (!user) { setLoading(false); return; }
    const role = user.role;
    const isL1 = ['super_admin', 'admin', 'csr', 'tl_management'].includes(role);

    let data = [];
    if (isL1) {
      // L1: fetch all non-VIP tickets server-side, limit 200 active
      data = await db.Ticket.filter({ is_vip: false }, '-created_date', 200);
    } else {
      // L2: fetch only tickets assigned to this user
      data = await db.Ticket.filter({ assigned_to: user.email, is_vip: false }, '-created_date', 100);
    }

    // For L2, also check dept history client-side (small result set)
    let result = data || [];
    if (!isL1) {
      const dept = ROLE_TO_DEPT[role];
      const extra = await db.Ticket.filter({ is_vip: false }, '-created_date', 200);
      const deptTickets = (extra || []).filter(t =>
        t.created_by_id === user.id ||
        (dept && (t.dept_sla_log || []).some(log => log.department === dept))
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

  return (
    <div className="p-4 md:p-6 h-full">
      <div className="mb-4">
        <h1 className="font-sora text-2xl font-bold">Tickets</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
      </div>
      <StaffMessenger tickets={tickets} loading={loading} autoOpenTicketId={autoOpenId} />
    </div>
  );
}