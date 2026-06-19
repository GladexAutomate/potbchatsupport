import { useState } from 'react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { X, Send, Loader2, Users } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const PRIORITY_COLOR = {
  Low: 'bg-slate-500/10 text-slate-400',
  Medium: 'bg-blue-500/10 text-blue-400',
  High: 'bg-amber-500/10 text-amber-400',
  Critical: 'bg-red-500/10 text-red-500',
};
const STATUS_COLOR = {
  Open: 'bg-blue-500/10 text-blue-400',
  'In Progress': 'bg-amber-500/10 text-amber-400',
  'Pending Department': 'bg-purple-500/10 text-purple-400',
  'Pending Resolution': 'bg-orange-500/10 text-orange-400',
  Resolved: 'bg-green-500/10 text-green-400',
  Closed: 'bg-slate-500/10 text-slate-400',
};

export default function EndorseToGroupChatModal({ ticket, onClose }) {
  const { user } = useAuth();
  const [remarks, setRemarks] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await db.GroupChatMessage.create({
      sender_email: user?.email || '',
      sender_name: user?.full_name || user?.email || 'Staff',
      message: remarks.trim(),
      message_type: 'ticket_endorsement',
      ticket_ref: {
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        department: ticket.department || '',
        customer_name: ticket.customer_name,
        is_vip: ticket.is_vip || false,
        escalated: ticket.escalated || false,
      },
      read_by: [user?.email || ''],
      reactions: {},
    });
    setDone(true);
    setSending(false);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-md border border-border/50">
        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <p className="font-poppins font-bold text-lg">Endorsed to Group Chat!</p>
            <p className="text-muted-foreground text-sm mt-1">The team has been notified.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="font-poppins font-bold text-base">Endorse to Group Chat</h2>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ticket preview */}
            <div className="bg-muted/30 rounded-xl p-3.5 border border-border/50 mb-4">
              <p className="text-xs font-bold text-primary mb-1">{ticket.ticket_number}</p>
              <p className="text-sm font-semibold mb-2 leading-snug">{ticket.subject}</p>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[ticket.priority] || 'bg-muted'}`}>{ticket.priority}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[ticket.status] || 'bg-muted'}`}>{ticket.status}</span>
                {ticket.department && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">{ticket.department}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Customer: {ticket.customer_name}</p>
            </div>

            {/* Remarks */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Add Remarks <span className="normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="e.g. Please assist this customer ASAP, VIP client..."
                rows={3}
                className="w-full text-sm rounded-xl border border-input bg-muted/30 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1 gap-2" onClick={handleSend} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send to Group Chat
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}