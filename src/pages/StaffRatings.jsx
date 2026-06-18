import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { Star, TrendingUp, Users, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { startOfDay, startOfWeek, startOfMonth, subDays, format, isAfter } from 'date-fns';

const PERIODS = ['Daily', 'Weekly', 'Monthly'];

function StarDisplay({ rating, size = 'sm' }) {
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`${sz} ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/20'}`} />
      ))}
    </div>
  );
}

export default function StaffRatings() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('Weekly');

  useEffect(() => {
    Promise.all([
      db.StaffRating.list('-rated_at', 500),
      db.EmployeeAccount.list('', 500)
    ]).then(([ratingData, empData]) => {
      const potbEmails = new Set((empData || [])
        .filter(e => e.employee_code?.toUpperCase().startsWith('POTB'))
        .map(e => e.email?.toLowerCase())
      );
      setRatings((ratingData || []).filter(r => potbEmails.has(r.staff_email?.toLowerCase())));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const getPeriodStart = () => {
    const now = new Date();
    if (period === 'Daily') return startOfDay(subDays(now, 6));
    if (period === 'Weekly') return startOfWeek(subDays(now, 27));
    return startOfMonth(subDays(now, 89));
  };

  const filteredRatings = ratings.filter(r => isAfter(new Date(r.rated_at), getPeriodStart()));

  // Per-staff stats
  const staffMap = {};
  filteredRatings.forEach(r => {
    if (!staffMap[r.staff_email]) {
      staffMap[r.staff_email] = { name: r.staff_name || r.staff_email, email: r.staff_email, total: 0, count: 0, remarks: [] };
    }
    staffMap[r.staff_email].total += r.rating;
    staffMap[r.staff_email].count += 1;
    if (r.remarks) staffMap[r.staff_email].remarks.push({ text: r.remarks, rating: r.rating, date: r.rated_at });
  });
  const staffList = Object.values(staffMap)
    .map(s => ({ ...s, avg: s.count ? (s.total / s.count).toFixed(1) : 0 }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.avg - a.avg);

  // Chart data: ratings over time grouped by day/week
  const chartData = (() => {
    const buckets = {};
    filteredRatings.forEach(r => {
      const key = period === 'Daily'
        ? format(new Date(r.rated_at), 'MMM d')
        : period === 'Weekly'
          ? `W${format(new Date(r.rated_at), 'w')}`
          : format(new Date(r.rated_at), 'MMM');
      if (!buckets[key]) buckets[key] = { label: key, total: 0, count: 0 };
      buckets[key].total += r.rating;
      buckets[key].count += 1;
    });
    return Object.values(buckets).map(b => ({ ...b, avg: (b.total / b.count).toFixed(1) }));
  })();

  const overallAvg = filteredRatings.length
    ? (filteredRatings.reduce((s, r) => s + r.rating, 0) / filteredRatings.length).toFixed(1)
    : '—';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-poppins font-bold text-2xl">Staff Ratings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Customer satisfaction analytics per agent</p>
        </div>
        {/* Period Toggle */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${period === p ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          </div>
          <div>
            <p className="text-2xl font-poppins font-bold">{overallAvg}</p>
            <p className="text-xs text-muted-foreground">Overall Avg Rating</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-poppins font-bold">{filteredRatings.length}</p>
            <p className="text-xs text-muted-foreground">Total Ratings ({period})</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-poppins font-bold">{staffList.length}</p>
            <p className="text-xs text-muted-foreground">Agents Rated</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <h2 className="font-poppins font-semibold text-sm mb-4">Average Rating Over Time</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v} ⭐`, 'Avg Rating']} />
              <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-staff table */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          <h2 className="font-poppins font-semibold text-sm">Agent Leaderboard</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : staffList.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No ratings in this period yet.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {staffList.map((staff, idx) => (
              <div key={staff.email} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                      idx === 1 ? 'bg-slate-400/20 text-slate-400' :
                      idx === 2 ? 'bg-amber-700/20 text-amber-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{staff.name}</p>
                      <p className="text-xs text-muted-foreground">{staff.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-poppins font-bold text-yellow-500">{staff.avg}</p>
                      <p className="text-xs text-muted-foreground">{staff.count} rating{staff.count !== 1 ? 's' : ''}</p>
                    </div>
                    <StarDisplay rating={Math.round(staff.avg)} />
                  </div>
                </div>
                {/* Recent remarks */}
                {staff.remarks.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {staff.remarks.slice(0, 3).map((r, i) => (
                      <div key={i} className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2">
                        <StarDisplay rating={r.rating} />
                        <p className="text-xs text-muted-foreground flex-1">"{r.text}"</p>
                        <span className="text-xs text-muted-foreground/50 shrink-0">{format(new Date(r.date), 'MMM d')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}