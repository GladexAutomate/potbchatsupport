import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import StaffMessenger from '@/components/StaffMessenger';

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Ticket.list('-created_date', 200).then(data => {
      setTickets(data || []);
      setLoading(false);
    });
    const unsub = base44.entities.Ticket.subscribe(() => {
      base44.entities.Ticket.list('-created_date', 200).then(data => setTickets(data || []));
    });
    return () => unsub();
  }, []);

  return (
    <div className="p-4 md:p-6 h-full">
      <div className="mb-4">
        <h1 className="font-sora text-2xl font-bold">Tickets</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
      </div>
      <StaffMessenger tickets={tickets} loading={loading} />
    </div>
  );
}