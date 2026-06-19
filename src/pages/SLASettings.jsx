import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function SLASettings() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [initialResponseSLA, setInitialResponseSLA] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ticketType, setTicketType] = useState('external'); // 'external' or 'internal'
  const { toast } = useToast();

  // Check role-based access
  const hasAccess = user && ['super_admin', 'tl_management'].includes(user.role);

  useEffect(() => {
    if (!hasAccess) return;
    Promise.all([
      base44.entities.SLAPolicy.list(),
      base44.entities.AppSettings.filter({ key: 'initial_response_sla_seconds' })
    ]).then(([policyData, settingsData]) => {
      setPolicies(policyData || []);
      if (settingsData && settingsData.length > 0) {
        setInitialResponseSLA(Number(settingsData[0].value) || 5);
      } else {
        setInitialResponseSLA(5);
      }
      setLoading(false);
    }).catch(err => {
      console.error('Error loading SLA settings:', err);
      setLoading(false);
    });
  }, [hasAccess]);

  const handleUpdate = (id, field, value) => {
    setSaved(false);
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, [field]: Number(value) || 0 } : p));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // Save SLA policies
      await Promise.all(policies.map(p =>
        base44.entities.SLAPolicy.update(p.id, {
          response_time_hours: p.response_time_hours,
          resolution_time_hours: p.resolution_time_hours
        })
      ));

      // Save initial response SLA setting
      const existingSetting = await base44.entities.AppSettings.filter({ key: 'initial_response_sla_seconds' });
      if (existingSetting && existingSetting.length > 0) {
        await base44.entities.AppSettings.update(existingSetting[0].id, {
          value: String(initialResponseSLA)
        });
      } else {
        await base44.entities.AppSettings.create({
          key: 'initial_response_sla_seconds',
          value: String(initialResponseSLA),
          label: 'Initial Response SLA (seconds)'
        });
      }

      setSaved(true);
      toast({ title: 'Success', description: 'SLA policies updated successfully.' });
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving SLA policies:', err);
      toast({ title: 'Error', description: 'Failed to save SLA policies.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <Card className="max-w-sm text-center">
          <CardContent className="p-8">
            <p className="text-destructive font-semibold mb-2">Access Denied</p>
            <p className="text-sm text-muted-foreground">Only TL/Management and Super Admins can modify SLA policies.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-1">
          <Clock className="w-8 h-8 text-primary" />
          SLA Policies
        </h1>
        <p className="text-muted-foreground">Configure response and resolution time thresholds for each priority level.</p>
      </div>

      {/* Initial Response SLA */}
      <Card className="mb-6 border border-border/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Initial Response SLA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="initial-response-sla" className="text-sm font-medium">
              Seconds to Initial Response
            </Label>
            <Input
              id="initial-response-sla"
              type="number"
              min="1"
              value={initialResponseSLA}
              onChange={(e) => {
                setInitialResponseSLA(Number(e.target.value) || 5);
              }}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground mt-2">Applies to all new customer and internal tickets</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setTicketType('external')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            ticketType === 'external'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground hover:bg-secondary/80'
          }`}
        >
          External Tickets
        </button>
        <button
          onClick={() => setTicketType('internal')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            ticketType === 'internal'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground hover:bg-secondary/80'
          }`}
        >
          Internal Tickets
        </button>
      </div>

      <div className="space-y-4 mb-6">
        {policies.map(p => (
          <Card key={p.id} className="border border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">{p.priority} Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`response-${p.id}`} className="text-sm font-medium">
                    First Response (hours)
                  </Label>
                  <Input
                    id={`response-${p.id}`}
                    type="number"
                    min="0"
                    step="0.5"
                    value={p.response_time_hours || 0}
                    onChange={(e) => handleUpdate(p.id, 'response_time_hours', e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`resolution-${p.id}`} className="text-sm font-medium">
                    Full Resolution (hours)
                  </Label>
                  <Input
                    id={`resolution-${p.id}`}
                    type="number"
                    min="0"
                    step="0.5"
                    value={p.resolution_time_hours || 0}
                    onChange={(e) => handleUpdate(p.id, 'resolution_time_hours', e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={saveAll}
          disabled={saving || policies.length === 0}
          className="bg-primary hover:bg-primary/90"
        >
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save All Changes'}
        </Button>
        {saved && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Saved</span>
          </div>
        )}
      </div>
    </div>
  );
}