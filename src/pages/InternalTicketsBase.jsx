import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, AlertCircle } from 'lucide-react';

const statusColors = {
  'Open': 'bg-blue-500/20 text-blue-300',
  'In Progress': 'bg-purple-500/20 text-purple-300',
  'Pending': 'bg-yellow-500/20 text-yellow-300',
  'Resolved': 'bg-green-500/20 text-green-300',
  'Closed': 'bg-gray-500/20 text-gray-300'
};

const priorityColors = {
  'Low': 'bg-blue-500/20 text-blue-300',
  'Medium': 'bg-yellow-500/20 text-yellow-300',
  'High': 'bg-orange-500/20 text-orange-300',
  'Critical': 'bg-red-500/20 text-red-300'
};

const departmentOptions = [
  'Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'
];

export default function InternalTicketsBase({ userDepartment }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ to_department: '', subject: '', description: '', priority: 'Medium' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load tickets created by OR assigned to this user's department
      const created = await base44.entities.InternalTicket.filter({ from_department: userDepartment });
      const assigned = await base44.entities.InternalTicket.filter({ to_department: userDepartment });
      
      const allTickets = [...(created || []), ...(assigned || [])];
      const uniqueTickets = Array.from(new Map(allTickets.map(t => [t.id, t])).values());
      setTickets(uniqueTickets.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const generateTicketNumber = () => {
    const now = new Date();
    return `INT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;
  };

  const handleCreate = async () => {
    if (!form.to_department || !form.subject || !form.description) {
      setError('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      await base44.entities.InternalTicket.create({
        ticket_number: generateTicketNumber(),
        from_department: userDepartment,
        to_department: form.to_department,
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        status: 'Open',
        created_by_email: user?.email || '',
        created_by_name: user?.full_name || '',
        escalated: false
      });

      setForm({ to_department: '', subject: '', description: '', priority: 'Medium' });
      setOpenDialog(false);
      setError('');
      await loadData();
    } catch (err) {
      console.error('Error creating ticket:', err);
      setError('Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const createdTickets = tickets.filter(t => t.from_department === userDepartment);
  const assignedTickets = tickets.filter(t => t.to_department === userDepartment);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Internal Tickets - {userDepartment}</h1>
          <p className="text-muted-foreground text-sm">Manage internal requests with other departments</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Internal Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded p-3 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label>To Department *</Label>
                <Select value={form.to_department} onValueChange={(val) => setForm({ ...form, to_department: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.filter(d => d !== userDepartment).map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input placeholder="Ticket subject" value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea placeholder="Describe your request..." value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} className="min-h-24" />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(val) => setForm({ ...form, priority: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Low', 'Medium', 'High', 'Critical'].map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...
                </> : 'Create Ticket'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Created Tickets */}
      <div>
        <h2 className="font-semibold text-lg mb-4">Tickets I Created ({createdTickets.length})</h2>
        {createdTickets.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No tickets created yet
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {createdTickets.map(ticket => (
              <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
                        <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
                        <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                      </div>
                      <h3 className="font-semibold">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground mt-1">→ {ticket.to_department}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-right">
                    {new Date(ticket.created_date).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Assigned Tickets */}
      <div>
        <h2 className="font-semibold text-lg mb-4">Tickets Assigned to {userDepartment} ({assignedTickets.length})</h2>
        {assignedTickets.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No tickets assigned yet
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {assignedTickets.map(ticket => (
              <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
                        <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
                        <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                      </div>
                      <h3 className="font-semibold">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground mt-1">← from {ticket.from_department}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-right">
                    {new Date(ticket.created_date).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}