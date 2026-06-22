import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, Loader2, MessageSquareText } from 'lucide-react';

export default function ReplyingCenter() {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ shortcut: '', topic: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = () =>
    db.SavedReply.list('-created_date', 200).then(d => {
      setReplies(d || []);
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ shortcut: '', topic: '', message: '' });
    setModalOpen(true);
  };

  const openEdit = (reply) => {
    setEditing(reply);
    setForm({ shortcut: reply.shortcut, topic: reply.topic || '', message: reply.message });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.shortcut.trim() || !form.message.trim()) return;
    setSaving(true);
    if (editing) {
      await db.SavedReply.update(editing.id, form);
    } else {
      await db.SavedReply.create(form);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    await db.SavedReply.delete(id);
    setDeleting(null);
    load();
  };

  const filtered = replies.filter(r =>
    !search ||
    r.shortcut?.toLowerCase().includes(search.toLowerCase()) ||
    r.topic?.toLowerCase().includes(search.toLowerCase()) ||
    r.message?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-bold flex items-center gap-2">
          <MessageSquareText className="w-6 h-6 text-primary" /> Replying Center
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage saved quick replies for your support team</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search shortcuts or messages..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Create
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-10">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-44">Shortcut</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-32">Topic</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Message</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No saved replies yet. Click Create to add one.</td></tr>
            ) : filtered.map((r, i) => (
              <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                <td className="px-4 py-3 font-mono font-semibold text-primary text-xs uppercase tracking-wide">{r.shortcut}</td>
                <td className="px-4 py-3">
                  {r.topic && (
                    <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">{r.topic}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs">
                  <p className="truncate">{r.message}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-11 w-11 select-none" onClick={() => openEdit(r)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive hover:text-destructive select-none"
                      onClick={() => handleDelete(r.id)} disabled={deleting === r.id}>
                      {deleting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Saved Reply' : 'Create Saved Reply'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Shortcut <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. GREETING, PAYMENT_LINK"
                value={form.shortcut}
                onChange={e => setForm(f => ({ ...f, shortcut: e.target.value.toUpperCase() }))}
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">Used to quickly find this reply while chatting</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Topic (optional)</Label>
              <Input
                placeholder="e.g. Billing, Onboarding"
                value={form.topic}
                onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Type the full reply message..."
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="min-h-32 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.shortcut.trim() || !form.message.trim()} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}