import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, Loader2, Tag } from 'lucide-react';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#64748b',
  '#000000', '#7c3aed', '#db2777', '#dc2626',
];

export default function ConversationTags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1', is_active: true });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = () =>
    base44.entities.ConversationTag.list('-created_date', 300).then(d => {
      setTags(d || []);
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', color: '#6366f1', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (tag) => {
    setEditing(tag);
    setForm({ name: tag.name, color: tag.color || '#6366f1', is_active: tag.is_active !== false });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await base44.entities.ConversationTag.update(editing.id, form);
    } else {
      await base44.entities.ConversationTag.create(form);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    await base44.entities.ConversationTag.delete(id);
    setDeleting(null);
    load();
  };

  const toggleActive = async (tag) => {
    await base44.entities.ConversationTag.update(tag.id, { is_active: !tag.is_active });
    load();
  };

  const activeTags = tags.filter(t => t.is_active !== false);
  const inactiveTags = tags.filter(t => t.is_active === false);
  const displayed = (tab === 'active' ? activeTags : inactiveTags).filter(t =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-bold flex items-center gap-2">
          <Tag className="w-6 h-6 text-primary" /> Conversation Tags
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Organize and label conversations with custom tags</p>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tags..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Add Tag
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border/50">
        {['active', 'inactive'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
              ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'active' ? `Active Tags (${activeTags.length})` : `Deactivated Tags (${inactiveTags.length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-10">No.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Tag Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-24">Color</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No tags found.</td></tr>
            ) : displayed.map((tag, i) => (
              <tr key={tag.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" style={{ color: tag.color || '#6366f1' }} />
                    <span className="font-semibold">{tag.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="w-8 h-5 rounded" style={{ background: tag.color || '#6366f1' }} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => toggleActive(tag)}>
                      {tab === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tag)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tag.id)} disabled={deleting === tag.id}>
                      {deleting === tag.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Tag' : 'Add New Tag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tag Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. VIP_CLIENT, BILLING"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-md border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border border-border" />
                <span className="text-xs text-muted-foreground font-mono">{form.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Add Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}