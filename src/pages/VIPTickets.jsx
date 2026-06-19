import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { getAppEnv } from '@/lib/appEnv';
import StaffMessenger from '@/components/StaffMessenger';
import { Crown } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const CSR_ROLES = ['super_admin', 'admin', 'csr', 'tl_management'];
const ROLE_TO_DEPT = {
  it: 'IT',
  sales: 'Sales',
  accounting: 'Accounting',
  sign_ups: 'Sign-Ups',
  on_boarding: 'On-Boarding',
  corp_training: 'Corp/Training',
  tl_management: 'TL/Management',
};

export default function VIPTickets() {
  const { user } = useAuth();
  const location = useLocation();
  const [tickets, setTickets] = useState([]);
  const [vipEmails, setVipEmails] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const autoOpenId = new URLSearchParams(location.search).get('open');

  const filterTicketsForUser = (allTickets) => {
    if (!user) return [];
    const role = user.role;
    const currentEnv = getAppEnv();
    const targetEnv = currentEnv === 'preview' ? 'test' : 'prod';

    // Filter by environment first
    const envFiltered = allTickets.filter(t => (t.env || 'test') === targetEnv);

    // L1 (CSR) and TL/Management see all tickets (in current env)
    if (['super_admin', 'admin', 'csr', 'tl_management'].includes(role)) return envFiltered;

    // L2 roles: only assigned to them, created by them, or in their assignment history (in current env)
    return envFiltered.filter(t => {
      const isAssignedToUser = t.assigned_to?.toLowerCase() === user.email?.toLowerCase();
      const isCreatedByUser = t.created_by_id === user.id;
      const hasAssignmentHistory = (t.dept_sla_log || []).some(log => 
        log.department === ROLE_TO_DEPT[role]
      );
      return isAssignedToUser || isCreatedByUser || hasAssignmentHistory;
    });
  };

  useEffect(() => {
    db.VIPCustomer.list().then(vips => {
      setVipEmails(new Set((vips || []).map(v => v.email?.toLowerCase())));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    let loadTimer;

    const loadVIPTickets = () => {
      db.Ticket.list('-created_date', 200).then(data => {
        const filtered = filterTicketsForUser(data || []);
        // Match tickets that are flagged is_vip OR whose customer email is in the VIPCustomer list
        const vipOnly = filtered.filter(t =>
          t.is_vip === true || vipEmails.has(t.customer_email?.toLowerCase())
        );
        setTickets(vipOnly);
        setLoading(false);
      });
    };

    loadVIPTickets();
    // Real-time subscription with debounce to avoid rate limiting
    const unsub = db.Ticket.subscribe(() => {
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => loadVIPTickets(), 500);
    });
    return () => { clearTimeout(loadTimer); unsub(); };
  }, [user, vipEmails]);

  return (
    <div className="p-4 md:p-6 h-full">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <Crown className="w-4 h-4 text-yellow-600" />
          </div>
          <h1 className="font-sora text-2xl font-bold">VIP Tickets</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5 ml-10">
          {tickets.length} VIP ticket{tickets.length !== 1 ? 's' : ''} — priority customers only
        </p>
      </div>
      <StaffMessenger
        tickets={tickets}
        loading={loading}
        autoOpenTicketId={autoOpenId}
        isVIPPage={true}
      />
    </div>
  );
}