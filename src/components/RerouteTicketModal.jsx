import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowRightLeft, Loader2 } from 'lucide-react';

const DEPARTMENTS = ['Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'];
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
  const [department, setDepartment] = useState(ticket?.department || '');
  const [priority, setPriority] = useState(ticket?.priority || 'Medium');
  const [status, setStatus] = useState(ticket?.status || 'Open');
  const [escalated, setEscalated] = useState(ticket?.escalated || false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Ticket.update(ticket.id, {
      department,
      priority,
      status,
      escalated,
    });
    // Post a system note if provided
    if (note.trim()) {
      await base44.entities.TicketMessage.create({
        ticket_id: ticket.id,
        sender_email: 'system',
        sender_name: 'System',
        sender_role: 'staff',
        message: `🔀 Ticket rerouted to ${department} dept | Priority: ${priority} | ${escalated ? '⬆ Escalated' : 'Not escalated'}\nNote: ${note.trim()}`,
        attachments: [],
      });
    }
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
          <div className="space-y-1.5">
            <Label className="text-xs">Route to Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => (
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

          <div className="space-y-1.5">
            <Label className="text-xs">Routing Note (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add context for the receiving department..."
              className="h-20 resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !department} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            Reroute Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}