import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import StaffMessenger from '@/components/StaffMessenger';

export default function InternalEscalations() {
  const { user } = useAuth();
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      base44.entities.InternalTicket.filter({ escalated: true }).then(data => {
        setEscalations(data ? data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)) : []);
        setLoading(false);
      }).catch(err => {
        console.error('Error loading escalations:', err);
        setLoading(false);
      });
    };
    load();
    const unsub = base44.entities.InternalTicket.subscribe(load);
    return () => unsub();
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