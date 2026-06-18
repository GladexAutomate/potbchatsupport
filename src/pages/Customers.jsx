import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserCheck, Loader2, Edit2 } from 'lucide-react';
import VIPCustomerSection from '@/components/VIPCustomerSection';

const STAFF_ROLES = ['csr', 'it', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'admin', 'tl_management'];
const ALL_ROLES = ['customer', ...STAFF_ROLES];

const ROLE_LABEL = {
  customer: 'Customer',
  csr: 'CSR / L1 Support',
  it: 'IT (L2)',
  sales: 'Sales',
  accounting: 'Accounting',
  sign_ups: 'Sign-Ups',
  on_boarding: 'On-Boarding',
  corp_training: 'Corp / Training',
  admin: 'Admin',
  tl_management: 'TL / Management',
};

const ROLE_COLOR = {
  customer: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  csr: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  it: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  sales: 'bg-green-500/10 text-green-400 border-green-500/20',
  accounting: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  sign_ups: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  on_boarding: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  corp_training: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
  tl_management: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const DEPT_MAP = {
  csr: 'CSR/L1',
  it: 'IT',
  sales: 'Sales',
  accounting: 'Accounting',
  sign_ups: 'Sign-Ups',
  on_boarding: 'On-Boarding',
  corp_training: 'Corp/Training',
  admin: 'Admin',
  tl_management: 'TL/Management',
};

export default function Customers() {
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [userData, empData] = await Promise.all([
      base44.entities.User.list('-created_date', 200),
      base44.entities.EmployeeAccount.list('-created_date', 500),
    ]);
    setUsers(userData || []);
    setEmployees(empData || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Build email → employee map for cross-reference
  const empByEmail = {};
  for (const e of employees) {
    if (e.email) empByEmail[e.email.toLowerCase()] = e;
  }

  const matchesSearch = (u) =>
    !search
    || u.email?.toLowerCase().includes(search.toLowerCase())
    || u.full_name?.toLowerCase().includes(search.toLowerCase());

  const filteredCustomers = users.filter(u =>
    !STAFF_ROLES.includes(u.role)
    && !empByEmail[u.email?.toLowerCase()]  // exclude employee accounts
    && matchesSearch(u)
  );

  const customerCount = users.filter(u => u.role === 'customer').length;

  const handleSaveRole = async () => {
    if (!editUser) return;
    setSaving(true);
    await base44.entities.User.update(editUser.id, {
      role: editUser.role,
      department: DEPT_MAP[editUser.role] || '',
      is_active: editUser.is_active !== false,
    });
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...editUser } : u));
    setSaving(false);
    setEditUser(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sora text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {customerCount} customer accounts
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-green-400 opacity-80" />
            <div>
              <p className="text-2xl font-bold font-sora">{customerCount}</p>
              <p className="text-xs text-muted-foreground">Customer Accounts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* VIP Customers */}
      <div className="mb-6">
        <VIPCustomerSection />
      </div>

      {/* Customer Accounts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <UserCheck className="w-4 h-4 text-green-400" />
          <h2 className="font-sora font-semibold text-sm">Customer Accounts</h2>
          <span className="text-xs text-muted-foreground ml-1">({filteredCustomers.length})</span>
        </div>
        <Card className="border-border/50">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No customer accounts found</div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredCustomers.map(u => {
                  const emp = empByEmail[u.email?.toLowerCase()];
                  return (
                    <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-green-600">{(u.full_name || u.email)?.[0]?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{u.full_name || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-2">
                        {emp && <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{emp.employee_code}</span>}
                        {emp && <span className="text-xs text-muted-foreground">{emp.job_title}</span>}
                        <Badge className="bg-muted text-muted-foreground border-border text-xs">Customer</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setEditUser({ ...u })}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Role Modal */}
      {editUser && (
        <Dialog open onOpenChange={() => setEditUser(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit User Role</DialogTitle>
              <p className="text-xs text-muted-foreground">{editUser.email}</p>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={editUser.role} onValueChange={v => setEditUser(u => ({ ...u, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map(r => (
                      <SelectItem key={r} value={r}>
                        <div>
                          <p className="font-medium">{ROLE_LABEL[r]}</p>
                          {r === 'customer' && <p className="text-xs text-muted-foreground">Customer portal only</p>}
                          {r === 'admin' && <p className="text-xs text-muted-foreground">Full access to all pages</p>}
                          {STAFF_ROLES.includes(r) && r !== 'admin' && (
                            <p className="text-xs text-muted-foreground">Staff — internal dashboard access</p>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <input type="checkbox" id="active" checked={editUser.is_active !== false}
                  onChange={e => setEditUser(u => ({ ...u, is_active: e.target.checked }))}
                  className="w-4 h-4" />
                <label htmlFor="active" className="text-sm cursor-pointer">Active account</label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button onClick={handleSaveRole} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}