import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

const DEPARTMENTS = ['Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'];
const COLORS = ['#7C3AED','#2563EB','#D97706','#DC2626','#059669','#7C3AED','#DB2777','#0891B2'];

const ROLE_TO_DEPT = {
  it: 'IT',
  sales: 'Sales',
  accounting: 'Accounting',
  sign_ups: 'Sign-Ups',
  on_boarding: 'On-Boarding',
  corp_training: 'Corp/Training',
  tl_management: 'TL/Management',
};

export default function KPI() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  const filterTicketsForUser = (allTickets) => {
    if (!user) return [];
    const role = user.role;
    // L1 (CSR) and TL/Management see all tickets
    if (['super_admin', 'admin', 'csr', 'tl_management'].includes(role)) return allTickets;

    // L2 roles: only assigned to them, created by them, or in their assignment history
    return allTickets.filter(t => {
      const isAssignedToUser = t.assigned_to?.toLowerCase() === user.email?.toLowerCase();
      const isCreatedByUser = t.created_by_id === user.id;
      const hasAssignmentHistory = (t.dept_sla_log || []).some(log => 
        log.department === ROLE_TO_DEPT[role]
      );
      return isAssignedToUser || isCreatedByUser || hasAssignmentHistory;
    });
  };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      db.Ticket.list('-created_date', 500),
      db.EmployeeAccount.list('', 500)
    ]).then(([ticketData, empData]) => {
      const potbEmails = new Set((empData || [])
        .filter(e => e.employee_code?.toUpperCase().startsWith('POTB'))
        .map(e => e.email?.toLowerCase())
      );
      // Include UNASSIGNED tickets (the most SLA-risky backlog) in the dataset;
      // only exclude tickets explicitly assigned to non-POTB staff. Previously the
      // unassigned backlog was dropped before totals/SLA were computed.
      const potbFiltered = (ticketData || []).filter(t => !t.assigned_to || potbEmails.has(t.assigned_to?.toLowerCase()));
      const userFiltered = filterTicketsForUser(potbFiltered);
      setTickets(userFiltered);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const cutoff = new Date(Date.now() - parseInt(period) * 24 * 3600000);
  const filtered = tickets.filter(t => new Date(t.created_date) >= cutoff);

  const now = new Date();

  // Avg resolution time per department
  const deptStats = DEPARTMENTS.map(dept => {
    const deptTickets = filtered.filter(t => t.department === dept && t.resolved_at);
    const avgHours = deptTickets.length
      ? Math.round(deptTickets.reduce((sum, t) => sum + (new Date(t.resolved_at) - new Date(t.created_date)) / 3600000, 0) / deptTickets.length)
      : 0;
    return { dept: dept.replace('Corp/Training', 'Corp/Train.').replace('On-Boarding', 'On-Board.').replace('TL/Management', 'TL/Mgmt'), avgHours, count: deptTickets.length };
  }).filter(d => d.count > 0);

  // Agent stats
  const agentMap = {};
  filtered.forEach(t => {
    if (!t.assigned_to) return;
    if (!agentMap[t.assigned_to]) agentMap[t.assigned_to] = { assigned: 0, resolved: 0, breached: 0, totalResTime: 0 };
    agentMap[t.assigned_to].assigned++;
    if (t.status === 'Resolved' || t.status === 'Closed') {
      agentMap[t.assigned_to].resolved++;
      if (t.resolved_at) {
        agentMap[t.assigned_to].totalResTime += (new Date(t.resolved_at) - new Date(t.created_date)) / 3600000;
      }
    }
    if (t.sla_deadline && new Date(t.sla_deadline) < now && t.status !== 'Resolved' && t.status !== 'Closed') {
      agentMap[t.assigned_to].breached++;
    }
  });

  const agents = Object.entries(agentMap).map(([email, stats]) => ({
    email, ...stats,
    avgResTime: stats.resolved > 0 ? Math.round(stats.totalResTime / stats.resolved) : 0,
    resolutionRate: stats.assigned > 0 ? Math.round((stats.resolved / stats.assigned) * 100) : 0,
  })).filter(a => a.assigned > 0).sort((a, b) => b.assigned - a.assigned);

  // Status breakdown
  const statusData = ['Open', 'In Progress', 'Pending Department', 'Resolved', 'Closed'].map(s => ({
    name: s, value: filtered.filter(t => t.status === s).length
  })).filter(d => d.value > 0);

  const totalBreached = filtered.filter(t => t.sla_deadline && new Date(t.sla_deadline) < now && t.status !== 'Resolved' && t.status !== 'Closed').length;
  const totalResolved = filtered.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;
  const slaComplianceRate = filtered.length > 0 ? Math.round(((filtered.length - totalBreached) / filtered.length) * 100) : 100;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sora text-2xl font-bold">KPI & SLA Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Performance metrics for your support team</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Tickets', value: filtered.length, icon: Clock, color: 'text-primary' },
          { label: 'Resolved', value: totalResolved, icon: CheckCircle, color: 'text-green-500' },
          { label: 'SLA Breaches', value: totalBreached, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'SLA Compliance', value: `${slaComplianceRate}%`, icon: TrendingUp, color: slaComplianceRate >= 90 ? 'text-green-500' : 'text-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`font-sora text-3xl font-bold ${color}`}>{loading ? '—' : value}</p>
                </div>
                <Icon className={`w-5 h-5 mt-1 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* Avg Resolution by Department */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Avg Resolution Time by Department (hours)</CardTitle>
          </CardHeader>
          <CardContent>
            {deptStats.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No resolved tickets in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={deptStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="dept" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}h`, 'Avg Resolution']} />
                  <Bar dataKey="avgHours" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Pie */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Ticket Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No tickets in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Agent Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {agents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No agent data for this period</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border/50">
                  <tr>
                    {['Agent', 'Assigned', 'Resolved', 'Resolution Rate', 'Avg Resolution Time', 'SLA Breaches'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {agents.map(a => (
                    <tr key={a.email} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium truncate max-w-48">{a.email}</td>
                      <td className="px-4 py-3">{a.assigned}</td>
                      <td className="px-4 py-3">{a.resolved}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-1.5 w-16">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${a.resolutionRate}%` }} />
                          </div>
                          <span className={a.resolutionRate >= 80 ? 'text-green-500 font-medium' : 'text-amber-500 font-medium'}>{a.resolutionRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{a.avgResTime ? `${a.avgResTime}h` : '—'}</td>
                      <td className="px-4 py-3">
                        {a.breached > 0 ? (
                          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">{a.breached} breach{a.breached > 1 ? 'es' : ''}</Badge>
                        ) : (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">Clean</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}