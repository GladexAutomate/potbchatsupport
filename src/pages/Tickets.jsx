import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import StaffMessenger from '@/components/StaffMessenger';
import { useLocation } from 'react-router-dom';

// Roles that can see ALL tickets
const CSR_ROLES = ['super_admin', 'admin', 'csr', 'tl_management'];

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
  const autoOpenId = new URLSearchParams(location.search).get('openTicket');

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
    if (!user) return;
    const load = () => {
      base44.entities.Ticket.list('-created_date', 200).then(data => {
        const filtered = filterTicketsForUser(data || []);
        // Exclude VIP tickets — they live on the VIP Tickets page
        const nonVip = filtered.filter(t => !vipEmails.has(t.customer_email?.toLowerCase()));
        setTickets(nonVip);
        setLoading(false);
      });
    };
    load();
    const unsub = base44.entities.Ticket.subscribe(load);
    return () => unsub();
  }, [user, vipEmails]);

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