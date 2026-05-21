import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Clock, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const toPHTime = (dateStr) => new Date(new Date(dateStr).getTime() + 8 * 60 * 60 * 1000);

const formatPHTime = (dateStr) => {
  const d = toPHTime(dateStr);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${month} ${day}, ${hours}:${mins}`;
};

const STATUS_OPTIONS = ['Open', 'In Progress', 'Pending Department', 'Resolved', 'Closed'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];

const STATUS_COLOR = {
  'Open': 'text-blue-400',
  'In Progress': 'text-amber-400',
  'Pending Department': 'text-purple-400',
  'Resolved': 'text-green-400',
  'Closed': 'text-slate-400',
};

export default function TicketInfoSidebar({ ticket, onTicketUpdate }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [agents, setAgents] = useState([]);
  const [slaPolicy, setSlaPolicy] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    base44.entities.User.list().then(d => setAgents(d || []));
    base44.entities.SLAPolicy.filter({ priority: ticket.priority }).then(d => {
      if (d?.length) setSlaPolicy(d[0]);
    });
  }, [ticket.priority]);

  // Tick every minute for SLA countdown
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const handleChange = async (field, value, description, oldValue) => {
    await base44.entities.Ticket.update(ticket.id, { [field]: value });
    // Log to history
    await base44.entities.TicketHistory.create({
      ticket_id: ticket.id,
      event_type: field === 'status' ? 'status_changed' : field === 'priority' ? 'priority_changed' : 'assigned',
      description,
      actor: user?.full_name || user?.email || 'Staff',
      old_value: oldValue,
      new_value: value,
    });
    if (onTicketUpdate) onTicketUpdate({ ...ticket, [field]: value });
  };

  // SLA countdown
  const slaDeadline = ticket.sla_deadline ? new Date(ticket.sla_deadline) : null;
  const slaBreached = slaDeadline && now > slaDeadline;
  const slaMinutesLeft = slaDeadline ? differenceInMinutes(slaDeadline, now) : null;
  const slaLabel = slaBreached
    ? `Breached ${formatDistanceToNow(toPHTime(ticket.sla_deadline), { addSuffix: true })}`
    : slaMinutesLeft !== null
      ? slaMinutesLeft < 60
        ? `${slaMinutesLeft}m left`
        : `${Math.floor(slaMinutesLeft / 60)}h ${slaMinutesLeft % 60}m left`
      : null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-8 flex-shrink-0 bg-card border-l border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Show ticket info"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="w-64 flex-shrink-0 bg-card border-l border-border/50 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <span className="font-semibold text-sm">Ticket Info</span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 text-sm">
        {/* Customer */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer</p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              {ticket.customer_name?.[0] || 'C'}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate text-xs">{ticket.customer_name}</p>
              <p className="text-xs text-muted-foreground truncate">{ticket.customer_email}</p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Status</p>
          <Select value={ticket.status} onValueChange={v => handleChange('status', v, `Status changed to ${v}`, ticket.status)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Priority</p>
          <Select value={ticket.priority} onValueChange={v => handleChange('priority', v, `Priority changed to ${v}`, ticket.priority)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Assigned Agent */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Assigned To</p>
          <Select
            value={ticket.assigned_to || ''}
            onValueChange={v => handleChange('assigned_to', v, `Assigned to ${v}`, ticket.assigned_to)}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Unassigned</SelectItem>
              {agents.map(a => <SelectItem key={a.id} value={a.email}>{a.full_name || a.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* SLA */}
        {slaDeadline && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">SLA Deadline</p>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${slaBreached ? 'text-red-400' : slaMinutesLeft < 60 ? 'text-amber-400' : 'text-green-400'}`}>
              {slaBreached && <AlertTriangle className="w-3.5 h-3.5" />}
              <Clock className="w-3.5 h-3.5" />
              <span>{slaLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{formatPHTime(ticket.sla_deadline)}</p>
          </div>
        )}

        {/* Category & Department */}
        {ticket.category && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Category</p>
            <p className="text-xs">{ticket.category}</p>
          </div>
        )}
        {ticket.department && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Department</p>
            <p className="text-xs">{ticket.department}</p>
          </div>
        )}

        {/* Created */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Created</p>
          <p className="text-xs text-muted-foreground">{formatPHTime(ticket.created_date)}</p>
        </div>


      </div>
    </div>
  );
}