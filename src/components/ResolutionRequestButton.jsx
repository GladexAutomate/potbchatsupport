import { useState } from 'react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function ResolutionRequestButton({ ticket, onTicketUpdate }) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  const isClosed = ticket.status === 'Closed' || ticket.status === 'Resolved';
  const isPending = ticket.status === 'Pending Resolution';

  const handleRequestResolution = async () => {
    setSending(true);

    try {
      // Update ticket to "Pending Resolution" and store who triggered it + when
      const updated = await db.Ticket.update(ticket.id, {
        status: 'Pending Resolution',
        resolution_requested_at: new Date().toISOString(),
        resolution_requested_by: user?.email || '',
        resolution_requested_by_name: user?.full_name || user?.email || 'Support',
      });

      // Send resolution request message to customer
      await db.TicketMessage.create({
        ticket_id: ticket.id,
        sender_email: 'system',
        sender_name: 'Support Team',
        sender_role: 'staff',
        message: `Hi ${ticket.customer_name}, has your concern been resolved? Please reply below. If we don't hear from you in 3 minutes, this ticket will be automatically closed.`,
        is_internal: false,
        message_type: 'resolution_request',
        attachments: [],
      });

      await db.TicketHistory.create({
        ticket_id: ticket.id,
        event_type: 'status_changed',
        description: `Resolution check sent by ${user?.full_name || user?.email}`,
        actor: user?.full_name || user?.email || 'Staff',
        old_value: ticket.status,
        new_value: 'Pending Resolution',
      });

      setSending(false);
      if (onTicketUpdate) onTicketUpdate({ ...ticket, status: 'Pending Resolution', resolution_requested_by: user?.email });
    } catch (error) {
      console.error('Resolution request error:', error);
      setSending(false);
    }
  };

  if (isClosed) return null;

  return (
    <Button
      size="sm"
      variant={isPending ? 'secondary' : 'outline'}
      className={`gap-1.5 text-xs h-7 px-2.5 ${isPending ? 'text-green-600 border-green-500/40 bg-green-500/10' : 'text-green-600 border-green-500/40 hover:bg-green-500/10'}`}
      onClick={handleRequestResolution}
      disabled={sending || isPending}
      title="Ask customer if their concern is resolved"
    >
      {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
      {isPending ? 'Awaiting Response' : 'Mark Resolved?'}
    </Button>
  );
}