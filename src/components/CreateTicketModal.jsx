import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';

const CATEGORY_SUBCATEGORIES = {
  'Training & Coaching': ['Orientation', 'Refresher', 'Product Update', 'Digital Marketing', 'AI', 'LMS', 'Certificate', 'Coaching'],
  'Booking': ['Availability', 'Quotation', 'Rebooking', 'Voucher', 'Schedule', 'Booking Status'],
  'Travel Products': ['Rates', 'Itinerary', 'Inclusions', 'Validity', 'Tariff'],
  'Refunds': ['Flight', 'Hotel', 'Package', 'Refund Status'],
  'Payments & Wallet': ['Payment Status', 'Top-Up', 'Wallet Balance', 'Clawback'],
  'Account Management': ['Password Reset', 'User Update', 'User Access'],
  'Business Package': ['DTI', 'Business Permit', 'Onboarding Kit', 'Materials'],
  'Website & Portal': ['B2B Website', 'LakbayHub', 'Portal Access'],
  'Technical Support': ['System Error', 'Integration Error', 'Application Bug'],
  'Markup & Pricing': ['Incorrect Rate', 'Incorrect Markup', 'Pricing Issue']
};

export default function CreateTicketModal({ onTicketCreated }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [csrList, setCsrList] = useState([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    subject: '',
    description: '',
    category: '',
    subcategory: '',
    priority: 'Medium',
    department: '',
    assigned_to: '',
    source: 'Internal Staff'
  });

  useEffect(() => {
    const loadCsrs = async () => {
      try {
        const emps = await base44.entities.EmployeeAccount.filter({ current_role: 'csr', status: 'active', is_blocked: false });
        setCsrList(emps || []);
      } catch (err) {
        console.error('Failed to load CSRs:', err);
      }
    };
    if (open) loadCsrs();
  }, [open]);

  const handleCreate = async () => {
    if (!formData.customer_name.trim() || !formData.customer_email.trim() || !formData.subject.trim() || !formData.description.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    setLoading(true);
    const newTicket = await base44.entities.Ticket.create(formData);
    setLoading(false);
    setOpen(false);
    setFormData({
      customer_name: '',
      customer_email: '',
      subject: '',
      description: '',
      category: '',
      subcategory: '',
      priority: 'Medium',
      department: '',
      assigned_to: '',
      source: 'Internal Staff'
    });
    if (onTicketCreated) onTicketCreated(newTicket);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="gap-2 h-8 text-xs"
      >
        <Plus className="w-3.5 h-3.5" /> New Ticket
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
            <DialogDescription>Manually create a support ticket for internal tracking</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Customer Name *</label>
              <Input
                placeholder="Full name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Customer Email *</label>
              <Input
                placeholder="email@example.com"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                className="h-8 text-sm"
              />
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
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Category</label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v, subcategory: '' })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(CATEGORY_SUBCATEGORIES).map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.category && (
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Subcategory</label>
                <Select value={formData.subcategory} onValueChange={(v) => setFormData({ ...formData, subcategory: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_SUBCATEGORIES[formData.category].map(sub => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Department</label>
              <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {['Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'].map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">CSR / L1</label>
              <Select value={formData.assigned_to} onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Assign to CSR" />
                </SelectTrigger>
                <SelectContent>
                  {csrList.map(csr => (
                    <SelectItem key={csr.id} value={csr.email}>{csr.full_name}</SelectItem>
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
                Create Ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}