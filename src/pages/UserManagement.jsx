import { useState, useEffect } from 'react';
import { getAppEnv } from '@/lib/appEnv';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Users, Shield, Loader2, UserPlus, RefreshCw, Briefcase, BadgeCheck, Ban, Unlock, ToggleLeft, ToggleRight, ShieldCheck, Save, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const STAFF_ROLES = ['csr', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'admin', 'tl_management'];
const EDITABLE_ROLES = ['customer', ...STAFF_ROLES];

const ROLE_LABEL = {
  customer: 'Customer',
  csr: 'CSR / L1 Support',
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
  sales: 'bg-green-500/10 text-green-400 border-green-500/20',
  accounting: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  sign_ups: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  on_boarding: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  corp_training: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
  tl_management: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const suggestRole = (jobTitle) => {
  if (!jobTitle) return null;
  const title = jobTitle.toLowerCase();
  if (title.includes('csr') || title.includes('support')) return 'csr';
  if (title.includes('it') || title.includes('tech') || title.includes('developer')) return 'csr';
  if (title.includes('sales')) return 'sales';
  if (title.includes('accounting') || title.includes('finance')) return 'accounting';
  if (title.includes('sign') || title.includes('signup')) return 'sign_ups';
  if (title.includes('onboard') || title.includes('on-board')) return 'on_boarding';
  if (title.includes('training') || title.includes('coach')) return 'corp_training';
  if (title.includes('manager') || title.includes('lead') || title.includes('tl')) return 'tl_management';
  if (title.includes('admin')) return 'admin';
  return null;
};

const EMP_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'non_potb', label: 'Non-POTB' },
  { key: 'blocked', label: 'Blocked' },
];

export default function UserManagement() {
   const { user, refreshUserRole } = useAuth();
   const [employees, setEmployees] = useState([]);
   const [loading, setLoading] = useState(true);
   const [syncing, setSyncing] = useState(false);
   const [search, setSearch] = useState('');
   const [empTab, setEmpTab] = useState('all');
   const [inviteOpen, setInviteOpen] = useState(false);
   const [inviteEmail, setInviteEmail] = useState('');
   const [inviteRole, setInviteRole] = useState('csr');
   const [inviting, setInviting] = useState(false);
   const [actionLoading, setActionLoading] = useState(null);
   const [roleEditItem, setRoleEditItem] = useState(null);
   const [roleSaving, setRoleSaving] = useState(false);
   const [bulkApplyOpen, setBulkApplyOpen] = useState(false);
   const [bulkApplying, setBulkApplying] = useState(false);
   const [bulkRoleMappings, setBulkRoleMappings] = useState({});

  const loadData = async () => {
    setLoading(true);
    const env = getAppEnv() === 'preview' ? 'test' : 'prod';
    const empData = await db.EmployeeAccount.filter({ env }, '-created_date', 500);
    setEmployees(empData || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSyncEmployees = async () => {
    setSyncing(true);
    await base44.functions.invoke('syncEmployeeAccounts', { env: getAppEnv() });
    await loadData();
    setSyncing(false);
  };

  const filteredEmployees = employees.filter(e => {
    if (e.email?.toLowerCase() === 'automate@gladextours.com') return false;
    const isPotb = e.employee_code?.toUpperCase().startsWith('POTB');
    const isBlocked = !!e.is_blocked;
    if (empTab === 'active') { if (isBlocked || !isPotb || e.status !== 'active') return false; }
    else if (empTab === 'inactive') { if (isBlocked || !isPotb || e.status !== 'inactive') return false; }
    else if (empTab === 'non_potb') { if (isPotb) return false; }
    else if (empTab === 'blocked') { if (!isBlocked) return false; }
    return !search
      || e.email?.toLowerCase().includes(search.toLowerCase())
      || e.full_name?.toLowerCase().includes(search.toLowerCase())
      || e.employee_code?.toLowerCase().includes(search.toLowerCase())
      || e.job_title?.toLowerCase().includes(search.toLowerCase());
  });

  const handleBlockToggle = async (emp) => {
    setActionLoading(emp.id + '_block');
    const newBlocked = !emp.is_blocked;
    await db.EmployeeAccount.update(emp.id, { is_blocked: newBlocked });
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_blocked: newBlocked } : e));
    setActionLoading(null);
  };

  const handleAccessToggle = async (emp) => {
    setActionLoading(emp.id + '_access');
    const newAccess = !emp.portal_access_granted;
    await db.EmployeeAccount.update(emp.id, { portal_access_granted: newAccess });
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, portal_access_granted: newAccess } : e));
    setActionLoading(null);
  };

  const handleOpenRoleEdit = (emp) => {
    const suggested = suggestRole(emp.job_title);
    setRoleEditItem({ ...emp, _selectedRole: emp.POTBChatsupportrole || suggested || 'csr', _suggested: suggested });
  };

  const handleSaveRole = async () => {
    if (!roleEditItem || !roleEditItem._selectedRole) return;
    setRoleSaving(true);
    // Always save the custom role to EmployeeAccount — this is the source of truth
    await db.EmployeeAccount.update(roleEditItem.id, { POTBChatsupportrole: roleEditItem._selectedRole });
    setEmployees(prev => prev.map(e => e.id === roleEditItem.id ? { ...e, POTBChatsupportrole: roleEditItem._selectedRole } : e));

    const isCurrentUser = user?.email?.toLowerCase() === roleEditItem.email?.toLowerCase();

    // If saving role for current user, refresh their session
    if (isCurrentUser) {
      await refreshUserRole();
    } else {
      // For other users, force re-login so they pick up the new role
      try {
        await base44.functions.invoke('logoutUserByEmail', { target_email: roleEditItem.email });
      } catch (err) {
        console.warn('Logout error (non-critical):', err);
      }
    }
    setRoleSaving(false);
    setRoleEditItem(null);
  };

  const empTabCounts = {
    all: employees.filter(e => e.email?.toLowerCase() !== 'automate@gladextours.com').length,
    active: employees.filter(e => e.email?.toLowerCase() !== 'automate@gladextours.com' && !e.is_blocked && e.employee_code?.toUpperCase().startsWith('POTB') && e.status === 'active').length,
    inactive: employees.filter(e => e.email?.toLowerCase() !== 'automate@gladextours.com' && !e.is_blocked && e.employee_code?.toUpperCase().startsWith('POTB') && e.status === 'inactive').length,
    non_potb: employees.filter(e => e.email?.toLowerCase() !== 'automate@gladextours.com' && !e.employee_code?.toUpperCase().startsWith('POTB')).length,
    blocked: employees.filter(e => e.email?.toLowerCase() !== 'automate@gladextours.com' && !!e.is_blocked).length,
  };

  const activeEmpCount = employees.filter(e => e.status === 'active').length;

  const handleExport = () => {
    const exportable = ['active', 'inactive', 'non_potb'].includes(empTab)
      ? filteredEmployees
      : employees.filter(e => {
          const isPotb = e.employee_code?.toUpperCase().startsWith('POTB');
          const isBlocked = !!e.is_blocked;
          if (e.email?.toLowerCase() === 'automate@gladextours.com') return false;
          // default: export active POTB
          return !isBlocked && isPotb && e.status === 'active';
        });

    const rows = exportable.map(e => ({
       'Full Name': e.full_name || '',
       'Email': e.email || '',
       'Employee Code': e.employee_code || '',
       'Password': e.generated_password || '',
       'Job Title': e.job_title || '',
       'Status': e.is_blocked ? 'Blocked' : (e.status || ''),
       'App Role': ROLE_LABEL[e.POTBChatsupportrole] || e.POTBChatsupportrole || '',
     }));

    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const tabLabel = EMP_TABS.find(t => t.key === empTab)?.label || empTab;
    a.download = `employees_${tabLabel.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const handleBulkApplySuggestedRoles = async () => {
    setBulkApplying(true);
    const updates = [];
    for (const emp of filteredEmployees) {
      if (emp.is_blocked || (emp.email?.toLowerCase() === 'automate@gladextours.com')) continue;
      const customRole = bulkRoleMappings[emp.job_title];
      if (customRole && !emp.POTBChatsupportrole) {
        updates.push({ empId: emp.id, role: customRole });
      }
    }
    // Process updates sequentially with delays to avoid rate limits
    for (let i = 0; i < updates.length; i++) {
      const { empId, role } = updates[i];
      await db.EmployeeAccount.update(empId, { POTBChatsupportrole: role });
      if (i < updates.length - 1) await new Promise(r => setTimeout(r, 100)); // 100ms delay between updates
    }
    await loadData();
    setBulkApplyOpen(false);
    setBulkRoleMappings({});
    setBulkApplying(false);
  };

  const uniqueJobTitles = [...new Set(filteredEmployees.filter(e => !e.is_blocked && !e.POTBChatsupportrole && e.job_title).map(e => e.job_title))].sort();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sora text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {activeEmpCount} active staff · {employees.length} employees
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} variant="outline" className="gap-2">
          <UserPlus className="w-4 h-4" /> Invite User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: 'Total Employees', value: employees.length, icon: Users, color: 'text-primary' },
          { label: 'Active Staff', value: activeEmpCount, icon: Shield, color: 'text-blue-400' },
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
          <div className="flex items-center gap-2">
             {filteredEmployees.length > 0 && (
               <Button variant="outline" size="sm" onClick={() => setBulkApplyOpen(true)} className="gap-2">
                 <BadgeCheck className="w-4 h-4" />
                 Auto-Assign Roles
               </Button>
             )}
             {['active', 'inactive', 'non_potb'].includes(empTab) && filteredEmployees.length > 0 && (
               <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                 <Download className="w-4 h-4" />
                 Export CSV
               </Button>
             )}
             <Button variant="outline" size="sm" onClick={handleSyncEmployees} disabled={syncing} className="gap-2">
               {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
               Sync from Supabase
             </Button>
           </div>
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
            <div className="hidden sm:grid grid-cols-[2.25rem_1fr_8rem_7rem_5rem_1fr_7rem_5rem_6rem] gap-x-3 px-5 py-2 border-b border-border/50 bg-muted/30">
              <div />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name / Email</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emp. Code</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Title</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">App Role</span>
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
                  const isPotb = emp.employee_code?.toUpperCase().startsWith('POTB');
                  const isBlocked = !!emp.is_blocked;
                  const blockLoading = actionLoading === emp.id + '_block';
                  const accessLoading = actionLoading === emp.id + '_access';

                  // Show manage role button:
                  // - POTB: only when active tab (active status, not blocked)
                  // - Non-POTB: only when portal_access_granted is ON
                  const showRoleBtn = isPotb
                    ? (!isBlocked && emp.status === 'active')
                    : (!isBlocked && !!emp.portal_access_granted);

                  return (
                    <div key={emp.id} className={`hidden sm:grid grid-cols-[2.25rem_1fr_8rem_7rem_5rem_1fr_7rem_5rem_6rem] gap-x-3 items-center px-5 py-3.5 transition-colors ${isBlocked ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-muted/20'}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isBlocked ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                        <span className={`text-sm font-semibold ${isBlocked ? 'text-red-400' : 'text-primary'}`}>{emp.full_name?.[0]?.toUpperCase() || '?'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{emp.full_name || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                      </div>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground truncate">{emp.employee_code || '—'}</span>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground truncate">{emp.generated_password || '—'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium w-fit ${
                        isBlocked ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        emp.status === 'active' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      }`}>
                        {isBlocked ? 'blocked' : emp.status}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">{emp.job_title || '—'}</span>
                      {/* App Role */}
                      <span>
                        {emp.POTBChatsupportrole ? (
                          <span className={`text-xs border rounded px-1.5 py-0.5 ${ROLE_COLOR[emp.POTBChatsupportrole] || 'bg-muted text-muted-foreground border-border'}`}>
                            {ROLE_LABEL[emp.POTBChatsupportrole] || emp.POTBChatsupportrole}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </span>
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
                      {/* Actions: Block/Unblock + Manage Role */}
                      <span className="flex items-center gap-1.5 flex-wrap">
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
                        {showRoleBtn && (
                          <button
                            onClick={() => handleOpenRoleEdit(emp)}
                            title="Manage role"
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            Role
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manage Role Modal */}
      {roleEditItem && (
        <Dialog open onOpenChange={() => setRoleEditItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign User Role</DialogTitle>
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium">{roleEditItem.full_name}</p>
                <p className="text-xs text-muted-foreground">{roleEditItem.email}</p>
                <p className="text-xs text-muted-foreground">Code: {roleEditItem.employee_code || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">{roleEditItem.job_title || 'N/A'}</p>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={roleEditItem._selectedRole || ''} onValueChange={v => setRoleEditItem(item => ({ ...item, _selectedRole: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                  <SelectContent>
                    {EDITABLE_ROLES.map(r => (
                      <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {roleEditItem._suggested && roleEditItem._suggested !== roleEditItem._selectedRole && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-xs font-medium text-blue-600 mb-2">Auto-suggested based on job title:</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRoleEditItem(item => ({ ...item, _selectedRole: item._suggested }))}
                    className="w-full text-xs border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                  >
                    Use: {ROLE_LABEL[roleEditItem._suggested]}
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleEditItem(null)}>Cancel</Button>
              <Button onClick={handleSaveRole} disabled={roleSaving} className="gap-2">
                {roleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Bulk Apply Roles Modal */}
       {bulkApplyOpen && (
          <Dialog open onOpenChange={() => { setBulkApplyOpen(false); setBulkRoleMappings({}); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-primary" /> Auto-Assign Roles by Job Title
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Map job titles to app roles. Only employees without a role will be updated.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {uniqueJobTitles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No unassigned employees with job titles.</p>
                  ) : (
                    uniqueJobTitles.map(jobTitle => (
                      <div key={jobTitle} className="p-3 border border-border/50 rounded-lg space-y-2">
                        <p className="text-xs font-medium text-foreground">{jobTitle || '(No Title)'}</p>
                        <Select 
                          value={bulkRoleMappings[jobTitle] || ''} 
                          onValueChange={v => setBulkRoleMappings(prev => ({ ...prev, [jobTitle]: v }))}
                        >
                          <SelectTrigger className="text-xs"><SelectValue placeholder="Select role..." /></SelectTrigger>
                          <SelectContent>
                            {STAFF_ROLES.map(r => (
                              <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {filteredEmployees.filter(e => e.job_title === jobTitle && !e.is_blocked && !e.POTBChatsupportrole).length} employees
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setBulkApplyOpen(false); setBulkRoleMappings({}); }}>Cancel</Button>
                <Button onClick={handleBulkApplySuggestedRoles} disabled={bulkApplying || Object.keys(bulkRoleMappings).length === 0} className="gap-2">
                  {bulkApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                  Apply Roles
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