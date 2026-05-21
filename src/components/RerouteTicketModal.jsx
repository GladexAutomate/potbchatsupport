import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowRightLeft, Loader2 } from 'lucide-react';

const CSR_ROLES = ['admin', 'csr'];
const ALL_DEPARTMENTS = ['Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'];
// Non-CSR roles can only route back to L1/CSR queue (General = no dept, or these specific ones)
const CSR_BACK_DEPARTMENTS = ['General'];
const DEPARTMENTS = ALL_DEPARTMENTS; // used conditionally below
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'In Progress', 'Pending Department', 'Resolved', 'Closed'];

const DEPT_NOTES = {
  'Sales': 'Domestic / International inquiries',
  'IT': 'Technical issues, Bugs, System support (L2)',
  'Accounting': 'Payment verification, Credit transfer, Clawbacks',
  'Sign-Ups': 'Free business coaching, Non-B2B inquiries',
  'On-Boarding': 'Welcome Orientation, Business permits, Materials shipping',
  'Corp/Training': 'Training (Product), Updates, Visa, DOT',
  'Admin': 'Flight Changes, Voucher, Briefing of flights/activities',
  'TL/Management': 'Critical incidents, VIP concerns, SLA breaches, Department blockers',
};

export default function RerouteTicketModal({ ticket, onClose, onSaved }) {
  const { user } = useAuth();
  const isCSR = CSR_ROLES.includes(user?.role);
  // Non-CSR can only route back to L1/CSR — clear dept and set back to Open
  const availableDepartments = isCSR ? ALL_DEPARTMENTS : [];

  const [department, setDepartment] = useState(isCSR ? (ticket?.department || '') : '');
  const [priority, setPriority] = useState(ticket?.priority || 'Medium');
  const [status, setStatus] = useState(isCSR ? (ticket?.status || 'Open') : 'Open');
  const [escalated, setEscalated] = useState(ticket?.escalated || false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    if (isCSR) {
      await base44.entities.Ticket.update(ticket.id, { department, priority, status, escalated });
    } else {
      // Non-CSR: route back to L1/CSR by clearing department and resetting to Open
      await base44.entities.Ticket.update(ticket.id, { department: null, status: 'Open', escalated: false });
    }
    const routeMsg = isCSR
      ? `🔀 Ticket rerouted to ${department} dept | Priority: ${priority} | ${escalated ? '⬆ Escalated' : 'Not escalated'}`
      : `🔀 Ticket returned to L1/CSR queue`;

    const historyDesc = isCSR
      ? `Rerouted to ${department}${note.trim() ? ` — ${note.trim()}` : ''}`
      : `Returned to L1/CSR queue${note.trim() ? ` — ${note.trim()}` : ''}`;

    await Promise.all([
      base44.entities.TicketMessage.create({
        ticket_id: ticket.id,
        sender_email: 'system',
        sender_name: 'System',
        sender_role: 'staff',
        message: note.trim() ? `${routeMsg}\nNote: ${note.trim()}` : routeMsg,
        is_internal: true,
        attachments: [],
      }),
      base44.entities.TicketHistory.create({
        ticket_id: ticket.id,
        event_type: 'rerouted',
        description: historyDesc,
        actor: user?.full_name || user?.email || 'Staff',
        old_value: ticket.department || 'L1/CSR',
        new_value: isCSR ? department : 'L1/CSR',
      }),
    ]);

    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            Reroute / Escalate Ticket
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{ticket?.ticket_number} · {ticket?.subject}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isCSR && (
            <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/5 text-sm text-blue-600">
              This will return the ticket to the <strong>L1/CSR queue</strong> and mark it as <strong>Open</strong>.
            </div>
          )}

          {isCSR && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Route to Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {ALL_DEPARTMENTS.map(d => (
                      <SelectItem key={d} value={d}>
                        <div>
                          <p className="font-medium">{d}</p>
                          <p className="text-xs text-muted-foreground">{DEPT_NOTES[d]}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <input type="checkbox" id="escalate" checked={escalated} onChange={e => setEscalated(e.target.checked)}
                  className="w-4 h-4 accent-amber-500" />
                <label htmlFor="escalate" className="text-sm font-medium text-amber-600 cursor-pointer">
                  ⬆ Mark as Escalated
                  <p className="text-xs text-muted-foreground font-normal">Route to TL/Management for critical or VIP issues</p>
                </label>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Routing Note (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add context for the receiving team..."
              className="h-20 resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || (isCSR && !department)} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            {isCSR ? 'Reroute Ticket' : 'Return to L1/CSR'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}