import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, Clock, AlertTriangle, CheckCircle, TrendingUp, ArrowRight, User, Copy, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLOR = {
  'Open': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Pending Department': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Resolved': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Closed': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const PRIORITY_COLOR = {
  'Low': 'bg-slate-500/10 text-slate-400',
  'Medium': 'bg-blue-500/10 text-blue-400',
  'High': 'bg-amber-500/10 text-amber-400',
  'Critical': 'bg-red-500/10 text-red-500',
};

export default function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  const ticketUrl = `${window.location.origin}/submit-ticket`;
  const handleCopy = () => {
    navigator.clipboard.writeText(ticketUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    base44.entities.Ticket.list('-created_date', 100).then(data => {
      setTickets(data || []);
      setLoading(false);
    });
  }, []);

  const open = tickets.filter(t => t.status === 'Open').length;
  const inProgress = tickets.filter(t => t.status === 'In Progress').length;
  const resolved = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;
  const now = new Date();
  const breached = tickets.filter(t => t.sla_deadline && new Date(t.sla_deadline) < now && t.status !== 'Resolved' && t.status !== 'Closed').length;

  const recent = tickets.slice(0, 8);

  const StatCard = ({ label, value, icon: Icon, color, sub }) => (
    <Card className="border-border/50 hover:shadow-lg transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-medium mb-1">{label}</p>
            <p className={`font-sora text-3xl font-bold ${color}`}>{loading ? '—' : value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color === 'text-red-500' ? 'bg-red-500/10' : color === 'text-green-500' ? 'bg-green-500/10' : color === 'text-amber-500' ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Welcome back, {user?.full_name || 'Agent'}</p>
      </div>

      {/* Ticket Submission URL */}
      <Card className="border-border/50 mb-6">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer Ticket Submission URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-muted rounded-lg px-3 py-2 text-foreground truncate">{ticketUrl}</code>
            <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 shrink-0">
              {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open Tickets" value={open} icon={Ticket} color="text-primary" sub="Awaiting action" />
        <StatCard label="In Progress" value={inProgress} icon={Clock} color="text-amber-500" sub="Being handled" />
        <StatCard label="Resolved" value={resolved} icon={CheckCircle} color="text-green-500" sub="All time" />
        <StatCard label="SLA Breached" value={breached} icon={AlertTriangle} color="text-red-500" sub="Needs attention" />
      </div>

      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="font-sora text-base">Recent Tickets</CardTitle>
          <Link to="/tickets">
            <Button variant="ghost" size="sm" className="text-primary text-xs gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading tickets...</div>
          ) : recent.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No tickets yet</div>
          ) : (
            <div className="divide-y divide-border/50">
              {recent.map(t => {
                const slaOk = !t.sla_deadline || new Date(t.sla_deadline) > now || t.status === 'Resolved' || t.status === 'Closed';
                return (
                  <Link to={`/tickets/${t.id}`} key={t.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                        {!slaOk && <span className="text-xs text-red-500 font-medium">⚠ SLA Breached</span>}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">{t.customer_name} · {formatDistanceToNow(new Date(t.created_date), { addSuffix: true })}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-xs border ${PRIORITY_COLOR[t.priority]}`}>{t.priority}</Badge>
                      <Badge className={`text-xs border ${STATUS_COLOR[t.status]}`}>{t.status}</Badge>
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