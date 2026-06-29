import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { usePolling } from '@/lib/usePolling';
import StaffMessenger from '@/components/StaffMessenger';

export default function InternalEscalations() {
  const { user } = useAuth();
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      // Only customer-facing escalated tickets (Ticket entity)
      const escalatedTickets = await db.Ticket.filter({ escalated: true });
      const sorted = (escalatedTickets || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setEscalations(sorted);
    } catch (err) {
      console.error('Error loading escalations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let loadTimer;
    load();

    const unsub = db.Ticket.subscribe(() => {
      clearTimeout(loadTimer);
      loadTimer = setTimeout(load, 1500);
    });
    return () => { clearTimeout(loadTimer); unsub(); };
  }, [user]);

  // Realtime fallback: poll the escalations list in case the websocket is silent.
  usePolling(load, 8000, !!user);

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