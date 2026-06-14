import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Crown, Plus, Trash2, Edit2, Loader2, Search } from 'lucide-react';

export default function VIPCustomerSection() {
  const [vips, setVips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = new
  const [form, setForm] = useState({ name: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    base44.entities.VIPCustomer.list('-created_date', 200).then(d => {
      setVips(d || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', email: '', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (v) => {
    setEditing(v);
    setForm({ name: v.name, email: v.email, notes: v.notes || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    if (editing) {
      await base44.entities.VIPCustomer.update(editing.id, form);
    } else {
      await base44.entities.VIPCustomer.create(form);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    const vip = vips.find(v => v.id === id);
    if (vip) {
      // Create a regular customer User account
      try {
        const existingUser = await base44.entities.User.filter({ email: vip.email.toLowerCase() });
        if (!existingUser || existingUser.length === 0) {
          await base44.entities.User.create({
            email: vip.email,
            full_name: vip.name,
            role: 'customer',
          });
        }
      } catch (e) {
        console.error('Error creating customer account:', e);
      }
    }
    await base44.entities.VIPCustomer.delete(id);
    setDeleting(null);
    load();
  };

  const filtered = vips.filter(v =>
    !search ||
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-500" />
          <h2 className="font-sora font-semibold text-sm">VIP Customers</h2>
          <span className="text-xs text-muted-foreground ml-1">({vips.length})</span>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white h-8">
          <Plus className="w-3.5 h-3.5" /> Add VIP
        </Button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search VIP customers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {vips.length === 0
                ? 'No VIP customers yet. Add your first VIP.'
                : 'No results found.'}
            </div>
          ) : (
            <div className="divide-y divide-yellow-500/10">
              {filtered.map(v => (
                <div key={v.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-yellow-500/5 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <Crown className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{v.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 font-semibold border border-yellow-500/30">VIP</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{v.email}</p>
                    {v.notes && <p className="text-xs text-muted-foreground italic truncate mt-0.5">{v.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => handleDelete(v.id)}
                      disabled={deleting === v.id}
                    >
                      {deleting === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-500" />
              {editing ? 'Edit VIP Customer' : 'Add VIP Customer'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Customer full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email Address *</Label>
              <Input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="customer@email.com"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Top agent, premium plan..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.email.trim()}
              className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              {editing ? 'Save Changes' : 'Add VIP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}