import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Plus, ArrowUpDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const STATUS_COLOR = {
  'Open': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Pending Department': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Resolved': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Closed': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const PRIORITY_COLOR = {
  'Low': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Medium': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'High': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Critical': 'bg-red-500/10 text-red-500 border-red-500/20',
};

const DEPARTMENTS = ['All', 'Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'];

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const { user } = useAuth();

  const loadTickets = () => {
    base44.entities.Ticket.list('-created_date', 200).then(data => {
      setTickets(data || []);
      setLoading(false);
    });
  };

  useEffect(() => { loadTickets(); }, []);

  const now = new Date();

  const filtered = tickets.filter(t => {
    const matchSearch = !search || t.subject?.toLowerCase().includes(search.toLowerCase())
      || t.customer_name?.toLowerCase().includes(search.toLowerCase())
      || t.ticket_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchDept = deptFilter === 'All' || t.department === deptFilter;
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchDept && matchPriority;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sora text-2xl font-bold">Tickets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {['All','Open','In Progress','Pending Department','Resolved','Closed'].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            {['All','Low','Medium','High','Critical'].map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">Loading tickets...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No tickets found</div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(t => {
                const slaBreached = t.sla_deadline && new Date(t.sla_deadline) < now && t.status !== 'Resolved' && t.status !== 'Closed';
                return (
                  <Link to={`/tickets/${t.id}`} key={t.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{t.ticket_number || 'No ID'}</span>
                        {slaBreached && <span className="text-xs text-red-500 font-semibold">⚠ SLA Breached</span>}
                        {t.escalated && <span className="text-xs text-amber-500">↑ Escalated</span>}
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.customer_name} · {t.category}
                        {t.department && ` → ${t.department}`}
                        {t.assigned_to && ` · Assigned: ${t.assigned_to}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-xs border ${PRIORITY_COLOR[t.priority] || ''}`}>{t.priority}</Badge>
                      <Badge className={`text-xs border ${STATUS_COLOR[t.status] || ''}`}>{t.status}</Badge>
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {formatDistanceToNow(new Date(t.created_date), { addSuffix: true })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}