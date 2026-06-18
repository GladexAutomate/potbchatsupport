import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { X, Clock, Tag, ArrowRightLeft, AlertTriangle, CheckCircle2, User, Loader2, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const toPHTime = (dateStr) => {
  const date = new Date(dateStr);
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
};

const formatPHTime = (dateStr) => {
  const d = toPHTime(dateStr);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${month} ${day}, ${hours}:${mins}`;
};

const EVENT_ICON = {
  created: { icon: Plus, color: 'text-green-400 bg-green-500/10' },
  status_changed: { icon: ArrowRightLeft, color: 'text-blue-400 bg-blue-500/10' },
  tag_applied: { icon: Tag, color: 'text-purple-400 bg-purple-500/10' },
  tag_removed: { icon: Tag, color: 'text-slate-400 bg-slate-500/10' },
  sla_breached: { icon: AlertTriangle, color: 'text-red-400 bg-red-500/10' },
  assigned: { icon: User, color: 'text-amber-400 bg-amber-500/10' },
  priority_changed: { icon: CheckCircle2, color: 'text-orange-400 bg-orange-500/10' },
  rerouted: { icon: ArrowRightLeft, color: 'text-cyan-400 bg-cyan-500/10' },
};

export default function TicketHistoryModal({ ticket, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.TicketHistory.filter({ ticket_id: ticket.id }, '-created_date', 100)
      .then(d => setHistory(d || []))
      .finally(() => setLoading(false));
  }, [ticket.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div>
            <h3 className="font-sora font-bold text-base">Ticket History</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{ticket.ticket_number}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-10">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No history recorded yet.
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border/50" />
              <div className="space-y-4">
                {history.map((item, idx) => {
                  const cfg = EVENT_ICON[item.event_type] || EVENT_ICON.created;
                  const Icon = cfg.icon;
                  return (
                    <div key={item.id || idx} className="flex gap-3 relative">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <p className="text-sm font-medium text-foreground leading-snug">{item.description}</p>
                        {(item.old_value || item.new_value) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.old_value && <span className="line-through mr-1">{item.old_value}</span>}
                            {item.new_value && <span className="text-primary font-medium">→ {item.new_value}</span>}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{formatPHTime(item.created_date)}</span>
                          {item.actor && <span className="text-xs text-muted-foreground">· {item.actor}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}