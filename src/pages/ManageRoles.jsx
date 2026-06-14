import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, Save } from 'lucide-react';

const STAFF_ROLES = ['csr', 'it', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'admin', 'tl_management'];
const EDITABLE_ROLES = ['csr', 'it', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'admin', 'tl_management', 'customer'];

const ROLE_LABEL = {
  customer: 'Customer',
  super_admin: 'Super Admin',
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
  customer: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  super_admin: 'bg-purple-600/20 text-purple-600 border-purple-600/30',
  csr: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  it: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  sales: 'bg-green-500/10 text-green-600 border-green-500/20',
  accounting: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  sign_ups: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  on_boarding: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  corp_training: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
  tl_management: 'bg-red-500/10 text-red-600 border-red-500/20',
};

// Auto-suggest role based on job title keywords
const suggestRole = (jobTitle) => {
  if (!jobTitle) return null;
  const title = jobTitle.toLowerCase();
  if (title.includes('csr') || title.includes('support')) return 'csr';
  if (title.includes('it') || title.includes('tech') || title.includes('developer')) return 'it';
  if (title.includes('sales')) return 'sales';
  if (title.includes('accounting') || title.includes('finance')) return 'accounting';
  if (title.includes('sign') || title.includes('signup')) return 'sign_ups';
  if (title.includes('onboard') || title.includes('on-board')) return 'on_boarding';
  if (title.includes('training') || title.includes('coach')) return 'corp_training';
  if (title.includes('manager') || title.includes('lead') || title.includes('tl')) return 'tl_management';
  if (title.includes('admin')) return 'admin';
  return null;
};

export default function ManageRoles() {
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [suggestedRole, setSuggestedRole] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [userData, empData] = await Promise.all([
      base44.entities.User.list('-created_date', 200),
      base44.entities.EmployeeAccount.filter({ status: 'active' }, '-created_date', 500),
    ]);
    setUsers(userData || []);
    setEmployees(empData || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Build email → user map
  const userByEmail = {};
  for (const u of users) {
    if (u.email) userByEmail[u.email.toLowerCase()] = u;
  }

  // Map all active employees with their user data (if exists), exclude super_admin
  const staffList = employees.map(emp => {
    const user = userByEmail[emp.email?.toLowerCase()];
    return {
      id: user?.id || emp.id,
      full_name: user?.full_name || emp.full_name || emp.name || 'N/A',
      email: emp.email,
      job_title: emp.job_title,
      role: user?.role || null,
      employee: emp,
      isUser: !!user,
      userId: user?.id,
    };
  }).filter(item => item.role !== 'super_admin');

  const matchesSearch = (item) =>
    !search
    || item.full_name?.toLowerCase().includes(search.toLowerCase())
    || item.email?.toLowerCase().includes(search.toLowerCase())
    || item.job_title?.toLowerCase().includes(search.toLowerCase());

  const filtered = staffList.filter(matchesSearch);

  const handleEditOpen = (item) => {
    setEditItem({ ...item });
    const suggested = suggestRole(item.job_title);
    setSuggestedRole(suggested);
  };

  const handleSaveRole = async () => {
    if (!editItem) return;
    setSaving(true);
    
    try {
      if (editItem.isUser) {
        // Update existing user
        await base44.entities.User.update(editItem.userId, { role: editItem.role });
        setUsers(prev => prev.map(u => u.id === editItem.userId ? { ...u, role: editItem.role } : u));
        // Trigger logout for this user to force re-login with new permissions
        try {
          await base44.functions.invoke('logoutUserByEmail', { target_email: editItem.email });
        } catch (err) {
          console.warn('Failed to trigger logout:', err);
        }
      } else {
        // Invite new user for employee
        await base44.users.inviteUser(editItem.email, editItem.role);
        // Refresh users list to show the new user
        await loadData();
      }
    } catch (error) {
      console.error('Error saving role:', error);
    }
    
    setSaving(false);
    setEditItem(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
         <div>
           <h1 className="font-sora text-2xl font-bold">Manage User Roles</h1>
           <p className="text-muted-foreground text-sm mt-0.5">
             {staffList.length} active employees in directory
           </p>
         </div>
       </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search name, email, job title..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Users Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No active staff members found</div>
          ) : (
             <div className="overflow-x-auto">
               <table className="w-full text-sm">
                 <thead className="border-b border-border/50 bg-muted/30">
                   <tr>
                     <th className="text-left px-5 py-3 font-medium text-muted-foreground">Name</th>
                     <th className="text-left px-5 py-3 font-medium text-muted-foreground">Email</th>
                     <th className="text-left px-5 py-3 font-medium text-muted-foreground">Job Title</th>
                     <th className="text-left px-5 py-3 font-medium text-muted-foreground">Current Role</th>
                     <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                     <th className="text-right px-5 py-3 font-medium text-muted-foreground">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border/50">
                   {filtered.map(item => (
                     <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                       <td className="px-5 py-3">
                         <p className="font-medium text-foreground">{item.full_name}</p>
                       </td>
                       <td className="px-5 py-3">
                         <p className="text-xs text-muted-foreground">{item.email}</p>
                       </td>
                       <td className="px-5 py-3">
                         <p className="text-sm text-muted-foreground">{item.job_title || '—'}</p>
                       </td>
                       <td className="px-5 py-3">
                         {item.role ? (
                           <Badge variant="outline" className={`text-xs ${ROLE_COLOR[item.role] || ''}`}>
                             {ROLE_LABEL[item.role]}
                             {item.role === 'super_admin' && ' 🔒'}
                           </Badge>
                         ) : (
                           <span className="text-xs text-muted-foreground">—</span>
                         )}
                       </td>
                       <td className="px-5 py-3">
                         <Badge variant="outline" className="text-xs">
                           {item.isUser ? 'Active' : 'Pending'}
                         </Badge>
                       </td>
                       <td className="px-5 py-3 text-right">
                         <Button 
                           size="sm" 
                           variant="outline" 
                           onClick={() => handleEditOpen(item)}
                           disabled={item.role === 'super_admin'}
                           className={item.role === 'super_admin' ? 'opacity-50 cursor-not-allowed' : ''}
                         >
                           {item.role === 'super_admin' ? 'Not Editable' : 'Edit Role'}
                         </Button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
        </CardContent>
      </Card>

      {/* Edit Role Modal */}
       {editItem && (
         <Dialog open onOpenChange={() => setEditItem(null)}>
           <DialogContent className="max-w-md">
             <DialogHeader>
               <DialogTitle>{editItem.isUser ? 'Edit' : 'Assign'} User Role</DialogTitle>
               <div className="mt-2 space-y-1">
                 <p className="text-sm font-medium">{editItem.full_name}</p>
                 <p className="text-xs text-muted-foreground">{editItem.email}</p>
                 <p className="text-xs text-muted-foreground">{editItem.job_title || 'N/A'}</p>
                 {!editItem.isUser && (
                   <p className="text-xs text-amber-600 mt-2">This employee hasn't logged in yet. Assigning a role will create their account.</p>
                 )}
               </div>
             </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={editItem.role} onValueChange={v => setEditItem(item => ({ ...item, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EDITABLE_ROLES.map(r => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-suggestion */}
              {suggestedRole && suggestedRole !== editItem.role && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-xs font-medium text-blue-600 mb-2">Auto-suggested based on job title:</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditItem(item => ({ ...item, role: suggestedRole }))}
                    className="w-full text-xs border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                  >
                    Use: {ROLE_LABEL[suggestedRole]}
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
              <Button onClick={handleSaveRole} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editItem.isUser ? 'Save' : 'Create'} Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}