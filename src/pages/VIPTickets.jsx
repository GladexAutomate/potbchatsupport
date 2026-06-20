import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import StaffMessenger from '@/components/StaffMessenger';
import { Crown } from 'lucide-react';
import { useLocation } from 'react-router-dom';


export default function VIPTickets() {
  const { user } = useAuth();
  const location = useLocation();
  const [tickets, setTickets] = useState([]);
  const [vipEmails, setVipEmails] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const autoOpenId = new URLSearchParams(location.search).get('open');

  // Server-side filter: only VIP tickets
  const loadVIPTickets = async () => {
    if (!user) { setLoading(false); return; }
    const data = await db.Ticket.filter({ is_vip: true }, '-created_date', 200);
    setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    db.VIPCustomer.list().then(vips => {
      setVipEmails(new Set((vips || []).map(v => v.email?.toLowerCase())));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let loadTimer;
    loadVIPTickets();
    // Debounced subscription — 1.5s buffer to reduce re-renders under high traffic
    const unsub = db.Ticket.subscribe(() => {
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => loadVIPTickets(), 1500);
    });
    return () => { clearTimeout(loadTimer); unsub(); };
  }, [user]);

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