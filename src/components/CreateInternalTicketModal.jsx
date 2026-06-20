import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';

const ALL_DEPARTMENTS = ['CSR', 'Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'];

export default function CreateInternalTicketModal({ onTicketCreated }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    from_department: '',
    to_department: '',
    subject: '',
    description: '',
    priority: 'Medium'
  });

  // Initialize from_department based on user role
  useEffect(() => {
    if (open && user) {
      const ROLE_TO_DEPT = {
        csr: 'CSR', sales: 'Sales', it: 'IT', accounting: 'Accounting',
        sign_ups: 'Sign-Ups', on_boarding: 'On-Boarding', corp_training: 'Corp/Training',
        admin: 'Admin', tl_management: 'TL/Management',
      };
      const dept = ROLE_TO_DEPT[user.role?.toLowerCase()] || '';
      if (dept) setFormData(prev => ({ ...prev, from_department: dept }));
    }
  }, [open, user]);

  const handleCreate = async () => {
    if (!formData.from_department || !formData.to_department || !formData.subject || !formData.description) {
      setError('Please fill in all required fields');
      return;
    }
    if (formData.from_department === formData.to_department) {
      setError('From and To departments must be different');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const newTicket = await db.InternalTicket.create({
        ticket_number: `INT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`,
        from_department: formData.from_department,
        to_department: formData.to_department,
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority,
        status: 'Open',
        created_by_email: user?.email || '',
        created_by_name: user?.full_name || '',
      });
      setLoading(false);
      setOpen(false);
      setFormData({
        from_department: formData.from_department,
        to_department: '',
        subject: '',
        description: '',
        priority: 'Medium'
      });
      if (onTicketCreated) onTicketCreated(newTicket);
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to create ticket. Please try again.');
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="gap-1.5 h-8 text-xs"
      >
        <Plus className="w-3.5 h-3.5" /> Create
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md mx-4 sm:max-w-md px-4 sm:px-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Internal Ticket</DialogTitle>
            <DialogDescription>Submit an internal ticket to another department</DialogDescription>
          </DialogHeader>
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">From Department *</label>
              <Input
                placeholder="Your department"
                value={formData.from_department}
                disabled
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">To Department *</label>
              <Select value={formData.to_department} onValueChange={(v) => setFormData({ ...formData, to_department: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_DEPARTMENTS.filter(d => d !== formData.from_department).map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Subject *</label>
              <Input
                placeholder="Brief description"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Description *</label>
              <Textarea
                placeholder="Full details"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="text-sm h-20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Priority</label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Low', 'Medium', 'High', 'Critical'].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading} className="h-8">
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={loading} className="h-8 gap-1.5">
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}