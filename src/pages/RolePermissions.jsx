import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { getAppEnv } from '@/lib/appEnv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronUp, Lock, Zap, Shield, Save, RotateCcw, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const PAGES = [
  { name: 'dashboard', label: 'Dashboard', description: 'Overview of ticket stats, team performance, and live activity feed.' },
  { name: 'tickets', label: 'Tickets', description: 'Full ticket queue — view, filter, and manage all customer support tickets.' },
  { name: 'vip-tickets', label: 'VIP Tickets', description: 'Filtered view of tickets from VIP customers, flagged for priority handling.' },
  { name: 'escalations', label: 'Escalations', description: 'View and manage escalated tickets requiring urgent or senior attention.' },
  { name: 'group-chat', label: 'Group Chat', description: 'Internal team chat for staff collaboration, ticket endorsements, and announcements.' },
  { name: 'kpi', label: 'KPI & SLA', description: 'Key performance indicators: response times, resolution rates, and SLA compliance.' },
  { name: 'staff-ratings', label: 'Staff Ratings', description: 'View customer satisfaction ratings and feedback submitted per staff member.' },
  { name: 'users', label: 'User Management', description: 'View and manage employee accounts, block/unblock users, and assign app roles.' },
  { name: 'customers', label: 'Customers', description: 'Browse registered customer accounts and manage their profile details.' },
  { name: 'manage-roles', label: 'Role Permissions', description: 'Configure page and feature access permissions for each staff role.' },
  { name: 'sla-settings', label: 'SLA Policies', description: 'Configure SLA response and resolution time thresholds by priority level.' },
  { name: 'test-accounts', label: 'Test Accounts', description: 'Manage test login credentials for QA and testing purposes.' },
  { name: 'chatbot-config', label: 'Chatbot Config', description: 'Configure the AI chatbot embed URL, greeting message, and escalation settings.' },
  { name: 'replying-center', label: 'Replying Center', description: 'Focused inbox for responding to open tickets with saved replies and attachments.' },
  { name: 'conversation-tags', label: 'Conversation Tags', description: 'Create and manage tags used to categorize and label support tickets.' },
  { name: 'internal-tickets', label: 'Internal Tickets', description: 'Inter-department tickets — view, create, and manage internal escalations between departments.' },
];

const FEATURES = [
  { name: 'create_ticket', label: 'Create Ticket', description: 'Allows staff to open new support tickets on behalf of customers.' },
  { name: 'edit_ticket', label: 'Edit Ticket', description: 'Allows editing ticket details such as subject, category, priority, and description.' },
  { name: 'delete_ticket', label: 'Delete Ticket', description: 'Permanently removes a ticket and all its messages from the system.' },
  { name: 'assign_ticket', label: 'Assign Ticket', description: 'Assign a ticket to a specific CSR agent or department for handling.' },
  { name: 'escalate_ticket', label: 'Escalate Ticket', description: 'Mark a ticket as escalated to flag it for urgent or senior attention.' },
  { name: 'manage_tags', label: 'Manage Tags', description: 'Create, edit, or delete conversation tags used across the ticketing system.' },
  { name: 'view_analytics', label: 'View Analytics', description: 'Access charts and metrics for team performance, ticket volumes, and SLA data.' },
  { name: 'manage_users', label: 'Manage Users', description: 'Block/unblock employees and grant or revoke portal access for non-POTB staff.' },
  { name: 'assign_roles', label: 'Assign Roles', description: 'Set or change the app role of an employee, determining their access level.' },
  { name: 'view_vip', label: 'View VIP Customers', description: 'Access the VIP customer list and see which tickets are flagged as VIP.' },
  { name: 'rate_staff', label: 'Rate Staff', description: 'Submit satisfaction ratings and remarks for staff who handled a ticket.' },
  { name: 'group_chat', label: 'Use Group Chat', description: 'Send messages, share files, and endorse tickets in the internal group chat.' },
];

const ROLES = ['admin', 'csr', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'tl_management'];

const ROLE_COLORS = {
  admin: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
  csr: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
  sales: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
  accounting: 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100',
  sign_ups: 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100',
  on_boarding: 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100',
  corp_training: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
  tl_management: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
};

export default function RolePermissions() {
  const [savedPermissions, setSavedPermissions] = useState([]); // source of truth from DB
  const [draftPermissions, setDraftPermissions] = useState([]); // local working copy
  const [selectedRole, setSelectedRole] = useState('admin');
  const [expandedSections, setExpandedSections] = useState({ pages: true, features: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copyMode, setCopyMode] = useState(false);
  const [copyFromRole, setCopyFromRole] = useState('');

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const data = await db.Permission.list(null, 1000);
      setSavedPermissions(data || []);
      setDraftPermissions(data || []);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPermission = (role, resourceType, resourceName) => {
    return draftPermissions.find(
      p => p.role === role && p.resource_type === resourceType && p.resource_name === resourceName
    );
  };

  // Check if there are unsaved changes for the current role
  const hasUnsavedChanges = () => {
    const allKeys = [...PAGES.map(p => `page_${selectedRole}_${p.name}`), ...FEATURES.map(f => `feature_${selectedRole}_${f.name}`)];
    return allKeys.some(key => {
      const [, role, ...rest] = key.split('_');
      const resourceType = key.startsWith('page') ? 'page' : 'feature';
      const resourceName = rest.join('_');
      const draft = draftPermissions.find(p => p.role === role && p.resource_type === resourceType && p.resource_name === resourceName);
      const saved = savedPermissions.find(p => p.role === role && p.resource_type === resourceType && p.resource_name === resourceName);
      return (draft?.has_access ?? false) !== (saved?.has_access ?? false);
    });
  };

  const togglePermission = (role, resourceType, resourceName, label) => {
    const perm = getPermission(role, resourceType, resourceName);
    const newAccess = perm ? !perm.has_access : true;
    setSaveSuccess(false);
    setSaveError('');

    if (perm) {
      setDraftPermissions(prev => prev.map(p =>
        p.role === role && p.resource_type === resourceType && p.resource_name === resourceName
          ? { ...p, has_access: newAccess }
          : p
      ));
    } else {
      setDraftPermissions(prev => [...prev, {
        id: `draft_${role}_${resourceType}_${resourceName}`,
        role, resource_type: resourceType, resource_name: resourceName, resource_label: label, has_access: newAccess
      }]);
    }
  };

  const savePermissions = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      // Find all changed permissions for current role
      const roleTypes = [
        ...PAGES.map(p => ({ resourceType: 'page', resourceName: p.name, label: p.label })),
        ...FEATURES.map(f => ({ resourceType: 'feature', resourceName: f.name, label: f.label })),
      ];

      for (const { resourceType, resourceName, label } of roleTypes) {
        const draft = draftPermissions.find(p => p.role === selectedRole && p.resource_type === resourceType && p.resource_name === resourceName);
        const saved = savedPermissions.find(p => p.role === selectedRole && p.resource_type === resourceType && p.resource_name === resourceName);
        const draftAccess = draft?.has_access ?? false;
        const savedAccess = saved?.has_access ?? false;

        if (draftAccess === savedAccess) continue; // no change

        if (saved && !saved.id.startsWith('draft_')) {
          // Update existing record
          await db.Permission.update(saved.id, { has_access: draftAccess });
        } else {
          // Create new record
          const created = await db.Permission.create({
            role: selectedRole, resource_type: resourceType, resource_name: resourceName,
            resource_label: label, has_access: draftAccess,
          });
          // Update draft with real id
          setDraftPermissions(prev => prev.map(p =>
            p.role === selectedRole && p.resource_type === resourceType && p.resource_name === resourceName
              ? created : p
          ));
        }
      }

      // Reload from DB to confirm
      const fresh = await db.Permission.list(null, 1000);
      setSavedPermissions(fresh || []);
      setDraftPermissions(fresh || []);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setDraftPermissions([...savedPermissions]);
    setSaveError('');
    setSaveSuccess(false);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyPermissions = async () => {
    if (!copyFromRole) {
      setSaveError('Select a source role to copy from');
      return;
    }
    if (copyFromRole === selectedRole) {
      setSaveError('Source role cannot be the same as target role');
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      const sourcePerms = draftPermissions.filter(p => p.role === copyFromRole);
      for (const sourcePerm of sourcePerms) {
        const existing = draftPermissions.find(p => 
          p.role === selectedRole && p.resource_type === sourcePerm.resource_type && p.resource_name === sourcePerm.resource_name
        );
        if (existing) {
          setDraftPermissions(prev => prev.map(p =>
            p.role === selectedRole && p.resource_type === sourcePerm.resource_type && p.resource_name === sourcePerm.resource_name
              ? { ...p, has_access: sourcePerm.has_access }
              : p
          ));
        } else {
          setDraftPermissions(prev => [...prev, {
            id: `draft_${selectedRole}_${sourcePerm.resource_type}_${sourcePerm.resource_name}`,
            role: selectedRole,
            resource_type: sourcePerm.resource_type,
            resource_name: sourcePerm.resource_name,
            resource_label: sourcePerm.resource_label,
            has_access: sourcePerm.has_access
          }]);
        }
      }
      setSaveSuccess(false);
      setSaveError('');
      setCopyMode(false);
      setCopyFromRole('');
    } catch (err) {
      console.error('Copy failed:', err);
      setSaveError('Failed to copy permissions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-poppins font-bold">Role Permissions</h1>
        </div>
        <p className="text-muted-foreground">Configure access control for pages and features across different user roles</p>
      </div>

      {/* Role Selector + Copy Option */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Select Role
            </CardTitle>
            {!copyMode && (
              <button
                onClick={() => setCopyMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted text-xs font-medium transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy from...
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {copyMode ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Copy all permissions from:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  {ROLES.filter(r => r !== selectedRole).map(role => (
                    <button
                      key={role}
                      onClick={() => setCopyFromRole(role)}
                      className={`px-3 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                        copyFromRole === role
                          ? `${ROLE_COLORS[role]} border-current`
                          : 'border-border/50 bg-muted/30 hover:border-border text-foreground'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={copyPermissions} disabled={saving || !copyFromRole} className="gap-2 bg-primary hover:bg-primary/90">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                  {saving ? 'Copying...' : 'Copy All'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setCopyMode(false); setCopyFromRole(''); }} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => {
                    if (hasUnsavedChanges() && role !== selectedRole) {
                      if (!window.confirm(`You have unsaved changes for "${selectedRole}". Discard and switch?`)) return;
                      discardChanges();
                    }
                    setSelectedRole(role);
                  }}
                  className={`px-3 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                    selectedRole === role
                      ? `${ROLE_COLORS[role]} border-current`
                      : 'border-border/50 bg-muted/30 hover:border-border text-foreground'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Bar */}
      <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
        <div className="flex-1">
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Permissions saved successfully!
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              {saveError}
            </div>
          )}
          {!saveSuccess && !saveError && (
            <p className="text-sm text-muted-foreground">
              {hasUnsavedChanges()
                ? <span className="text-amber-600 font-medium">⚠ You have unsaved changes for the <strong>{selectedRole}</strong> role</span>
                : `Editing permissions for: ${selectedRole}`}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={discardChanges} disabled={saving || !hasUnsavedChanges()} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Discard
        </Button>
        <Button size="sm" onClick={savePermissions} disabled={saving || !hasUnsavedChanges()} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Permissions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Page Access */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('pages')}
            >
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Page Access
              </CardTitle>
              {expandedSections.pages ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </CardHeader>
          {expandedSections.pages && (
            <CardContent className="space-y-2">
              {PAGES.map(page => {
                const perm = getPermission(selectedRole, 'page', page.name);
                const hasAccess = perm?.has_access ?? false;
                return (
                  <div
                   key={page.name}
                   className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                     hasAccess
                       ? 'bg-green-50/50 border-green-200/50'
                       : 'bg-muted/30 border-border/50'
                   }`}
                  >
                   <div className="flex-1 min-w-0 mr-3">
                     <p className="font-medium text-sm">{page.label}</p>
                     <p className="text-xs text-muted-foreground mt-0.5">{page.description}</p>
                   </div>
                   <Switch
                      checked={hasAccess}
                      onCheckedChange={() => togglePermission(selectedRole, 'page', page.name, page.label)}
                      disabled={saving}
                    />
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* Feature Access */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('features')}
            >
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-500" />
                Feature Access
              </CardTitle>
              {expandedSections.features ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </CardHeader>
          {expandedSections.features && (
            <CardContent className="space-y-2">
              {FEATURES.map(feature => {
                const perm = getPermission(selectedRole, 'feature', feature.name);
                const hasAccess = perm?.has_access ?? false;
                return (
                  <div
                   key={feature.name}
                   className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                     hasAccess
                       ? 'bg-green-50/50 border-green-200/50'
                       : 'bg-muted/30 border-border/50'
                   }`}
                  >
                   <div className="flex-1 min-w-0 mr-3">
                     <p className="font-medium text-sm">{feature.label}</p>
                     <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                   </div>
                   <Switch
                      checked={hasAccess}
                      onCheckedChange={() => togglePermission(selectedRole, 'feature', feature.name, feature.label)}
                      disabled={saving}
                    />
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}