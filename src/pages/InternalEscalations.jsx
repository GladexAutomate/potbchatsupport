import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import StaffMessenger from '@/components/StaffMessenger';

export default function InternalEscalations() {
  const { user } = useAuth();
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        // Load both escalated internal tickets and escalated regular tickets
        const [internalTickets, escalatedTickets] = await Promise.all([
          base44.entities.InternalTicket.filter({ escalated: true }),
          db.Ticket.filter({ escalated: true })
        ]);
        
        const combined = [...(internalTickets || []), ...(escalatedTickets || [])];
        const sorted = combined.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        setEscalations(sorted);
        setLoading(false);
      } catch (err) {
        console.error('Error loading escalations:', err);
        setLoading(false);
      }
    };
    load();
    
    // Subscribe to both entities
    const unsub1 = base44.entities.InternalTicket.subscribe(load);
    const unsub2 = db.Ticket.subscribe(load);
    return () => {
      unsub1?.();
      unsub2?.();
    };
  }, [user]);

  return (
    <div className="p-4 md:p-6 h-full">
      <div className="mb-4">
        <h1 className="font-sora text-2xl font-bold">Escalations</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{escalations.length} escalation{escalations.length !== 1 ? 's' : ''}</p>
      </div>
      <StaffMessenger tickets={escalations} loading={loading} isInternalTickets={true} />
    </div>
  );
}