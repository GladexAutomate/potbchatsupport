import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import StaffMessenger from '@/components/StaffMessenger';
import { Crown } from 'lucide-react';

const CSR_ROLES = ['admin', 'csr'];
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
  const [tickets, setTickets] = useState([]);
  const [vipEmails, setVipEmails] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const filterTicketsForUser = (allTickets) => {
    if (!user) return [];
    const role = user.role;
    if (CSR_ROLES.includes(role)) return allTickets;
    const dept = ROLE_TO_DEPT[role];
    return allTickets.filter(t =>
      t.assigned_to === user.email ||
      (dept && t.department === dept)
    );
  };

  useEffect(() => {
    base44.entities.VIPCustomer.list().then(vips => {
      setVipEmails(new Set((vips || []).map(v => v.email?.toLowerCase())));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || vipEmails.size === 0) return;

    const loadVIPTickets = () => {
      base44.entities.Ticket.list('-created_date', 200).then(data => {
        const filtered = filterTicketsForUser(data || []);
        const vipOnly = filtered.filter(t => vipEmails.has(t.customer_email?.toLowerCase()));
        setTickets(vipOnly);
        setLoading(false);
      });
    };

    loadVIPTickets();
    const unsub = base44.entities.Ticket.subscribe(() => loadVIPTickets());
    return () => unsub();
  }, [user, vipEmails]);

  // While VIP list is loading, don't show stale data
  useEffect(() => {
    if (vipEmails.size === 0) setLoading(true);
  }, [vipEmails]);

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
      <StaffMessenger tickets={tickets} loading={loading} />
    </div>
  );
}