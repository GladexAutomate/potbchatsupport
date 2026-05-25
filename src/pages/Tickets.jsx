import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import StaffMessenger from '@/components/StaffMessenger';
import { useLocation } from 'react-router-dom';

// Roles that can see ALL tickets
const CSR_ROLES = ['admin', 'csr'];

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
  const [loading, setLoading] = useState(true);
  const autoOpenId = new URLSearchParams(location.search).get('open');

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
    if (!user) return;
    base44.entities.Ticket.list('-created_date', 200).then(data => {
      setTickets(filterTicketsForUser(data || []));
      setLoading(false);
    });
    const unsub = base44.entities.Ticket.subscribe(() => {
      base44.entities.Ticket.list('-created_date', 200).then(data => {
        setTickets(filterTicketsForUser(data || []));
      });
    });
    return () => unsub();
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