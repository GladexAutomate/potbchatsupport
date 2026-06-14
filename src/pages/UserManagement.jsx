import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Users, Shield, UserCheck, Loader2, Edit2, UserPlus, RefreshCw, Briefcase, BadgeCheck, Ban, Unlock, ToggleLeft, ToggleRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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

function UserRow({ u, onEdit }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-primary">{(u.full_name || u.email)?.[0]?.toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{u.full_name || '—'}</p>
        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
      </div>
      <div className="hidden sm:flex items-center gap-2">
        {u.department && <span className="text-xs text-muted-foreground">{u.department}</span>}
        <Badge className={`text-xs border ${ROLE_COLOR[u.role] || 'bg-muted text-muted-foreground'}`}>
          {ROLE_LABEL[u.role] || u.role}
        </Badge>
        {u.is_active === false && (
          <Badge variant="outline" className="text-xs text-red-400 border-red-400/30">Inactive</Badge>
        )}
      </div>
      <span className="text-xs text-muted-foreground hidden md:block">
        {u.created_date ? formatDistanceToNow(new Date(u.created_date), { addSuffix: true }) : ''}
      </span>
      <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={onEdit}>
        <Edit2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

const EMP_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'non_potb', label: 'Non-POTB' },
  { key: 'blocked', label: 'Blocked' },
];

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [empTab, setEmpTab] = useState('all');
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('csr');
  const [inviting, setInviting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

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

  const handleSyncEmployees = async () => {
    setSyncing(true);
    await base44.functions.invoke('syncEmployeeAccounts', {});
    await loadData();
    setSyncing(false);
  };

  // Build email → employee map for cross-reference
  const empByEmail = {};
  for (const e of employees) {
    if (e.email) empByEmail[e.email.toLowerCase()] = e;
  }

  const matchesSearch = (u) =>
    !search
    || u.email?.toLowerCase().includes(search.toLowerCase())
    || u.full_name?.toLowerCase().includes(search.toLowerCase());

  const filteredEmployees = employees.filter(e => {
    if (e.email?.toLowerCase() === 'automate@gladextours.com') return false;
    const isPotb = e.employee_code?.toUpperCase().startsWith('POTB');
    const isBlocked = !!e.is_blocked;
    if (empTab === 'active') { if (isBlocked || !isPotb || e.status !== 'active') return false; }
    else if (empTab === 'inactive') { if (isBlocked || !isPotb || e.status !== 'inactive') return false; }
    else if (empTab === 'non_potb') { if (isPotb) return false; }
    else if (empTab === 'blocked') { if (!isBlocked) return false; }
    // 'all' tab: show everything (no code filter)
    else { /* all */ }
    return !search
      || e.email?.toLowerCase().includes(search.toLowerCase())
      || e.full_name?.toLowerCase().includes(search.toLowerCase())
      || e.employee_code?.toLowerCase().includes(search.toLowerCase())
      || e.job_title?.toLowerCase().includes(search.toLowerCase());
  });

  const handleBlockToggle = async (emp) => {
    setActionLoading(emp.id + '_block');
    const newBlocked = !emp.is_blocked;
    await base44.entities.EmployeeAccount.update(emp.id, { is_blocked: newBlocked });
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_blocked: newBlocked } : e));
    setActionLoading(null);
  };

  const handleAccessToggle = async (emp) => {
    setActionLoading(emp.id + '_access');
    const newAccess = !emp.portal_access_granted;
    await base44.entities.EmployeeAccount.update(emp.id, { portal_access_granted: newAccess });
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, portal_access_granted: newAccess } : e));
    setActionLoading(null);
  };

  const empTabCounts = {
    all: employees.filter(e => e.email?.toLowerCase() !== 'automate@gladextours.com').length,
    active: employees.filter(e => e.email?.toLowerCase() !== 'automate@gladextours.com' && !e.is_blocked && e.employee_code?.toUpperCase().startsWith('POTB') && e.status === 'active').length,
    inactive: employees.filter(e => e.email?.toLowerCase() !== 'automate@gladextours.com' && !e.is_blocked && e.employee_code?.toUpperCase().startsWith('POTB') && e.status === 'inactive').length,
    non_potb: employees.filter(e => e.email?.toLowerCase() !== 'automate@gladextours.com' && !e.employee_code?.toUpperCase().startsWith('POTB')).length,
    blocked: employees.filter(e => e.email?.toLowerCase() !== 'automate@gladextours.com' && !!e.is_blocked).length,
  };

  const filteredCustomers = users.filter(u =>
    !STAFF_ROLES.includes(u.role) && matchesSearch(u)
  );

  const activeEmpCount = employees.filter(e => e.status === 'active').length;
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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail.trim(), inviteRole === 'admin' ? 'admin' : 'user');
    setInviting(false);
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('csr');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sora text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {activeEmpCount} active staff · {customerCount} customers · {employees.length} employees
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} variant="outline" className="gap-2">
          <UserPlus className="w-4 h-4" /> Invite User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Employees', value: employees.length, icon: Users, color: 'text-primary' },
          { label: 'Active Staff', value: activeEmpCount, icon: Shield, color: 'text-blue-400' },
          { label: 'Customer Accounts', value: customerCount, icon: UserCheck, color: 'text-green-400' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color} opacity-80`} />
              <div>
                <p className="text-2xl font-bold font-sora">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search employees, email, code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Employee Directory */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-400" />
            <h2 className="font-sora font-semibold text-sm">Employee Directory</h2>
            <span className="text-xs text-muted-foreground ml-1">({filteredEmployees.length})</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleSyncEmployees} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync from Supabase
          </Button>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 mb-3 bg-muted/40 p-1 rounded-lg w-fit flex-wrap">
          {EMP_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setEmpTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                empTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                empTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>{empTabCounts[tab.key]}</span>
            </button>
          ))}
        </div>

        <Card className="border-border/50">
          <CardContent className="p-0">
          {/* Column Headers */}
          <div className="hidden sm:grid grid-cols-[2.25rem_1fr_8rem_5rem_1fr_5rem_5rem] gap-x-3 px-5 py-2 border-b border-border/50 bg-muted/30">
            <div />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name / Email</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emp. Code</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Title</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Access</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No records in this category.</div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredEmployees.map(emp => {
                  const appUser = empByEmail[emp.email?.toLowerCase()];
                  const isPotb = emp.employee_code?.toUpperCase().startsWith('POTB');
                  const isBlocked = !!emp.is_blocked;
                  const blockLoading = actionLoading === emp.id + '_block';
                  const accessLoading = actionLoading === emp.id + '_access';
                  return (
                    <div key={emp.id} className={`hidden sm:grid grid-cols-[2.25rem_1fr_8rem_5rem_1fr_5rem_5rem] gap-x-3 items-center px-5 py-3.5 transition-colors ${isBlocked ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-muted/20'}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isBlocked ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                        <span className={`text-sm font-semibold ${isBlocked ? 'text-red-400' : 'text-primary'}`}>{emp.full_name?.[0]?.toUpperCase() || '?'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{emp.full_name || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                        {appUser && (
                          <span className="text-xs flex items-center gap-1 text-primary mt-0.5">
                            <BadgeCheck className="w-3 h-3" /> App User
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground truncate">{emp.employee_code || '—'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium w-fit ${
                        isBlocked ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        emp.status === 'active' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      }`}>
                        {isBlocked ? 'blocked' : emp.status}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">{emp.job_title || '—'}</span>
                      {/* Access toggle — only relevant for non-POTB */}
                      <span>
                        {!isPotb && !isBlocked && (
                          <button
                            onClick={() => handleAccessToggle(emp)}
                            disabled={!!accessLoading}
                            title={emp.portal_access_granted ? 'Revoke access' : 'Grant portal access'}
                            className="flex items-center gap-1 text-xs"
                          >
                            {accessLoading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> :
                              emp.portal_access_granted
                                ? <ToggleRight className="w-5 h-5 text-green-500" />
                                : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                            }
                            <span className={emp.portal_access_granted ? 'text-green-600' : 'text-muted-foreground'}>
                              {emp.portal_access_granted ? 'On' : 'Off'}
                            </span>
                          </button>
                        )}
                      </span>
                      {/* Block / Unblock action */}
                      <span>
                        <button
                          onClick={() => handleBlockToggle(emp)}
                          disabled={!!blockLoading}
                          title={isBlocked ? 'Unblock user' : 'Block user'}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                            isBlocked
                              ? 'border-green-500/30 text-green-600 hover:bg-green-500/10'
                              : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                          }`}
                        >
                          {blockLoading ? <Loader2 className="w-3 h-3 animate-spin" /> :
                            isBlocked ? <Unlock className="w-3 h-3" /> : <Ban className="w-3 h-3" />
                          }
                          {isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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

      {/* Invite Staff Modal */}
      {inviteOpen && (
        <Dialog open onOpenChange={() => setInviteOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" /> Invite Staff Member
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Email Address</Label>
                <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="staff@company.com" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Staff Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                ℹ️ An invitation email will be sent. The user's role can be updated after they register.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="gap-2">
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}