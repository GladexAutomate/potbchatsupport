import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Clock, User, Building2, AlertTriangle, CheckCircle, Loader2, Tag } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Pending Department', 'Resolved', 'Closed'];
const DEPT_OPTIONS = ['Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];

const STATUS_COLOR = {
  'Open': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Pending Department': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Resolved': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Closed': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState({});

  useEffect(() => {
    base44.entities.Ticket.list().then(all => {
      const found = all.find(t => t.id === id);
      setTicket(found);
      setEdits({
        status: found?.status || 'Open',
        department: found?.department || '',
        assigned_to: found?.assigned_to || '',
        priority: found?.priority || 'Medium',
        resolution_notes: found?.resolution_notes || '',
        escalated: found?.escalated || false,
      });
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    const updates = { ...edits };
    if (edits.status === 'Resolved' && !ticket.resolved_at) {
      updates.resolved_at = new Date().toISOString();
    }
    if (!ticket.first_response_at && user?.email) {
      updates.first_response_at = new Date().toISOString();
      updates.assigned_to = edits.assigned_to || user.email;
    }
    await base44.entities.Ticket.update(id, updates);
    setTicket({ ...ticket, ...updates });
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (!ticket) return (
    <div className="p-6 text-center text-muted-foreground">Ticket not found.</div>
  );

  const now = new Date();
  const slaBreached = ticket.sla_deadline && new Date(ticket.sla_deadline) < now && ticket.status !== 'Resolved' && ticket.status !== 'Closed';
  const resolutionTime = ticket.resolved_at
    ? Math.round((new Date(ticket.resolved_at) - new Date(ticket.created_date)) / 3600000)
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tickets')} className="rounded-xl">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{ticket.ticket_number}</span>
            <Badge className={`text-xs border ${STATUS_COLOR[ticket.status]}`}>{ticket.status}</Badge>
            {slaBreached && <Badge className="text-xs border bg-red-500/10 text-red-500 border-red-500/20">SLA Breached</Badge>}
            {ticket.escalated && <Badge className="text-xs border bg-amber-500/10 text-amber-500 border-amber-500/20">Escalated</Badge>}
          </div>
          <h1 className="font-sora text-xl font-bold mt-1">{ticket.subject}</h1>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left - Details */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Customer Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{ticket.customer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{ticket.customer_email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{ticket.category}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* SLA Info */}
          <Card className={`border ${slaBreached ? 'border-red-500/30 bg-red-500/5' : 'border-border/50'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-4 h-4" /> SLA Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Created</p>
                <p className="font-medium">{format(new Date(ticket.created_date), 'MMM d, yyyy HH:mm')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">SLA Deadline</p>
                <p className={`font-medium ${slaBreached ? 'text-red-500' : ''}`}>
                  {ticket.sla_deadline ? format(new Date(ticket.sla_deadline), 'MMM d, yyyy HH:mm') : '—'}
                </p>
              </div>
              {resolutionTime !== null && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Resolution Time</p>
                  <p className="font-semibold text-green-500">{resolutionTime}h</p>
                </div>
              )}
              {ticket.first_response_at && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">First Response</p>
                  <p className="font-medium">{format(new Date(ticket.first_response_at), 'MMM d, HH:mm')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right - Actions */}
        <div className="space-y-5">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={edits.status} onValueChange={v => setEdits({...edits, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={edits.priority} onValueChange={v => setEdits({...edits, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Route to Department</Label>
                <Select value={edits.department || ''} onValueChange={v => setEdits({...edits, department: v})}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {DEPT_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assign To (agent email)</Label>
                <Input value={edits.assigned_to} onChange={e => setEdits({...edits, assigned_to: e.target.value})}
                  placeholder="agent@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Resolution Notes</Label>
                <Textarea value={edits.resolution_notes} onChange={e => setEdits({...edits, resolution_notes: e.target.value})}
                  placeholder="Add resolution notes..." className="min-h-[80px]" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="escalate" checked={edits.escalated}
                  onChange={e => setEdits({...edits, escalated: e.target.checked})}
                  className="rounded border-border" />
                <Label htmlFor="escalate" className="text-xs cursor-pointer">Mark as Escalated</Label>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}