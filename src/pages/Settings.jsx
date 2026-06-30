import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Clock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const DEFAULT_SLA = [
  { priority: 'Low', response_time_hours: 24, resolution_time_hours: 72 },
  { priority: 'Medium', response_time_hours: 8, resolution_time_hours: 24 },
  { priority: 'High', response_time_hours: 2, resolution_time_hours: 8 },
  { priority: 'Critical', response_time_hours: 0.5, resolution_time_hours: 2 },
];

export default function Settings() {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [policies, setPolicies] = useState(DEFAULT_SLA);
  const [policyIds, setPolicyIds] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Resolution auto-close setting
  const [autoCloseMinutes, setAutoCloseMinutes] = useState(3);
  const [autoCloseSettingId, setAutoCloseSettingId] = useState(null);
  const [savingResolution, setSavingResolution] = useState(false);
  const [savedResolution, setSavedResolution] = useState(false);

  useEffect(() => {
    base44.entities.SLAPolicy.list().then(data => {
      if (data?.length > 0) {
        const ids = {};
        const updated = DEFAULT_SLA.map(d => {
          const found = data.find(p => p.priority === d.priority);
          if (found) {
            ids[d.priority] = found.id;
            return { ...d, ...found };
          }
          return d;
        });
        setPolicies(updated);
        setPolicyIds(ids);
      }
    }).catch(() => {});

    base44.entities.AppSettings.filter({ key: 'resolution_auto_close_minutes' }).then(data => {
      if (data?.[0]) {
        setAutoCloseMinutes(parseFloat(data[0].value) || 3);
        setAutoCloseSettingId(data[0].id);
      }
    }).catch(() => {});
  }, []);

  const handleSaveResolution = async () => {
    setSavingResolution(true);
    const payload = { key: 'resolution_auto_close_minutes', value: String(autoCloseMinutes), label: 'Resolution Auto-Close (minutes)' };
    if (autoCloseSettingId) {
      await base44.entities.AppSettings.update(autoCloseSettingId, payload);
    } else {
      const created = await base44.entities.AppSettings.create(payload);
      setAutoCloseSettingId(created.id);
    }
    setSavingResolution(false);
    setSavedResolution(true);
    setTimeout(() => setSavedResolution(false), 2500);
  };

  const updatePolicy = (priority, field, value) => {
    setPolicies(prev => prev.map(p => p.priority === priority ? { ...p, [field]: parseFloat(value) || 0 } : p));
  };

  const handleSave = async () => {
    setSaving(true);
    for (const policy of policies) {
      const id = policyIds[policy.priority];
      if (id) {
        await base44.entities.SLAPolicy.update(id, policy);
      } else {
        const created = await base44.entities.SLAPolicy.create(policy);
        setPolicyIds(prev => ({ ...prev, [policy.priority]: created.id }));
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const PRIORITY_COLORS = {
    'Low': 'border-l-slate-400',
    'Medium': 'border-l-blue-500',
    'High': 'border-l-amber-500',
    'Critical': 'border-l-red-500',
  };

  // Only TL/Management and super admins may edit production SLA policies.
  const hasAccess = user && ['super_admin', 'tl_management'].includes(user.role);
  if (!hasAccess) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold mb-1">Access Restricted</p>
            <p className="text-sm text-muted-foreground">Only TL/Management and administrators can change SLA settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-bold">SLA Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Configure Service Level Agreement policies per priority</p>
      </div>

      <Card className="border-border/50 mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> SLA Policies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {policies.map(policy => (
            <div key={policy.priority} className={`border-l-4 ${PRIORITY_COLORS[policy.priority]} pl-4 py-3 rounded-r-lg bg-muted/20`}>
              <p className="text-sm font-semibold mb-3">{policy.priority} Priority</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">First Response (hours)</Label>
                  <Input
                    type="number" min="0" step="0.5"
                    value={policy.response_time_hours}
                    onChange={e => updatePolicy(policy.priority, 'response_time_hours', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Resolution Time (hours)</Label>
                  <Input
                    type="number" min="0" step="1"
                    value={policy.resolution_time_hours}
                    onChange={e => updatePolicy(policy.priority, 'resolution_time_hours', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Resolution Auto-Close Settings */}
      <Card className="border-border/50 mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Mark Resolved Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            When staff marks a ticket as resolved, the customer is notified and the ticket will auto-close if there is no response within this time.
          </p>
          <div className="flex items-center gap-3">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Auto-Close Delay (minutes)</Label>
              <Input
                type="number" min="1" step="1"
                value={autoCloseMinutes}
                onChange={e => setAutoCloseMinutes(parseFloat(e.target.value) || 1)}
                className="max-w-[140px]"
              />
            </div>
          </div>
          <Button onClick={handleSaveResolution} disabled={savingResolution} className="mt-4 bg-primary hover:bg-primary/90">
            {savingResolution ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : savedResolution ? (
              <><CheckCircle className="w-4 h-4 mr-2" /> Saved!</>
            ) : 'Save Resolution Settings'}
          </Button>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90">
        {saving ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
        ) : saved ? (
          <><CheckCircle className="w-4 h-4 mr-2" /> Saved!</>
        ) : 'Save SLA Policies'}
      </Button>

      {/* Sign Out — this only ends the current session. (Account deletion is an HR/
          admin action handled in User Management, not a self-service data wipe, so we
          no longer claim to "permanently delete all data" here.) */}
      <Card className="border-border/50 mt-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" /> Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Sign out of your account on this device.
          </p>
          <Button variant="outline" size="sm" disabled={deleting} onClick={async () => { setDeleting(true); await base44.auth.logout('/'); }} className="gap-2">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}