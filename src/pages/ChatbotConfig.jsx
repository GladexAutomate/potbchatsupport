import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Bot, Save, Eye, Loader2, CheckCircle, Pencil, X } from 'lucide-react';

export default function ChatbotConfig() {
  const [config, setConfig] = useState(null);
  const [configId, setConfigId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingEmbed, setEditingEmbed] = useState(false);
  const [form, setForm] = useState({
    embed_url: '',
    embed_type: 'iframe',
    is_active: true,
    greeting_message: 'Hi! How can we help you today?',
    escalation_message: 'Would you like to connect with a live agent?'
  });

  useEffect(() => {
    base44.entities.ChatbotConfig.list().then(configs => {
      if (configs?.[0]) {
        setConfig(configs[0]);
        setConfigId(configs[0].id);
        setForm({
          embed_url: configs[0].embed_url || '',
          embed_type: configs[0].embed_type || 'iframe',
          is_active: configs[0].is_active !== false,
          greeting_message: configs[0].greeting_message || 'Hi! How can we help you today?',
          escalation_message: configs[0].escalation_message || 'Would you like to connect with a live agent?',
        });
      }
    }).catch(() => {});
  }, []);

  const extractUrlFromEmbed = (code) => {
    // Extract src URL from iframe HTML if full code is pasted
    const match = code.match(/src=["']([^"']+)["']/);
    return match ? match[1] : code;
  };

  const handleSave = async () => {
    setSaving(true);
    const cleanUrl = extractUrlFromEmbed(form.embed_url);
    const dataToSave = { ...form, embed_url: cleanUrl };
    
    if (configId) {
      await base44.entities.ChatbotConfig.update(configId, dataToSave);
    } else {
      const created = await base44.entities.ChatbotConfig.create(dataToSave);
      setConfigId(created.id);
    }
    setForm(prev => ({ ...prev, embed_url: cleanUrl }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-bold">Chatbot Configuration</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Configure the AI chat widget shown to customers</p>
      </div>

      <div className="space-y-5">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" /> Embed Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div>
                <p className="text-sm font-medium">Enable AI Chatbot</p>
                <p className="text-xs text-muted-foreground">Show the chat widget on the customer portal</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={v => setForm({...form, is_active: v})} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Embed Type</Label>
              <Select value={form.embed_type} onValueChange={v => setForm({...form, embed_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="iframe">iFrame (URL embed)</SelectItem>
                  <SelectItem value="script">Script tag</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Chatbot URL / Embed Code</Label>
              {editingEmbed ? (
                <div className="space-y-2">
                  <Input
                    placeholder="https://your-chatbot-url.com/widget"
                    value={form.embed_url}
                    onChange={e => setForm({...form, embed_url: e.target.value})}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the URL from your chatbot provider (Tidio, Intercom, Crisp, etc.)
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave()} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
                      {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                      Save Embed Code
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingEmbed(false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/50 break-all text-sm font-mono text-muted-foreground">
                    {form.embed_url || 'No embed code configured'}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditingEmbed(true)} className="gap-2">
                    <Pencil className="w-3 h-3" /> Edit Embed Code
                  </Button>
                </div>
              )}
            </div>

            {form.embed_url && (
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(!previewOpen)} className="gap-2">
                <Eye className="w-4 h-4" /> {previewOpen ? 'Hide' : 'Preview'} Widget
              </Button>
            )}

            {previewOpen && form.embed_url && (
              <div className="rounded-xl overflow-hidden border border-border h-64">
                <iframe src={form.embed_url} className="w-full h-full border-0" title="Chatbot Preview" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Greeting Message</Label>
              <Textarea value={form.greeting_message}
                onChange={e => setForm({...form, greeting_message: e.target.value})}
                className="min-h-[60px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Escalation Message (shown when suggesting live agent)</Label>
              <Textarea value={form.escalation_message}
                onChange={e => setForm({...form, escalation_message: e.target.value})}
                className="min-h-[60px]" />
            </div>
          </CardContent>
        </Card>

        {!editingEmbed && (
          <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90">
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : saved ? (
              <><CheckCircle className="w-4 h-4 mr-2" /> Saved!</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Save Configuration</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}