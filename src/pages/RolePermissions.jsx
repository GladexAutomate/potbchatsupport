import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronUp, Lock, Zap, Shield } from 'lucide-react';

const PAGES = [
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'tickets', label: 'Tickets' },
  { name: 'kpi', label: 'KPI' },
  { name: 'chatbot-config', label: 'Chatbot Config' },
  { name: 'settings', label: 'Settings' },
  { name: 'users', label: 'User Management' },
  { name: 'manage-roles', label: 'Manage Roles' },
  { name: 'customers', label: 'Customers' },
  { name: 'replying-center', label: 'Replying Center' },
  { name: 'conversation-tags', label: 'Conversation Tags' },
  { name: 'staff-ratings', label: 'Staff Ratings' },
  { name: 'group-chat', label: 'Group Chat' },
  { name: 'vip-tickets', label: 'VIP Tickets' },
];

const FEATURES = [
  { name: 'create_ticket', label: 'Create Ticket' },
  { name: 'edit_ticket', label: 'Edit Ticket' },
  { name: 'delete_ticket', label: 'Delete Ticket' },
  { name: 'assign_ticket', label: 'Assign Ticket' },
  { name: 'escalate_ticket', label: 'Escalate Ticket' },
  { name: 'manage_tags', label: 'Manage Tags' },
  { name: 'view_analytics', label: 'View Analytics' },
  { name: 'manage_users', label: 'Manage Users' },
  { name: 'assign_roles', label: 'Assign Roles' },
  { name: 'view_vip', label: 'View VIP Customers' },
  { name: 'rate_staff', label: 'Rate Staff' },
  { name: 'group_chat', label: 'Use Group Chat' },
];

const ROLES = ['admin', 'CSR', 'IT', 'Sales', 'Finance', 'Manager', 'Supervisor'];

const ROLE_COLORS = {
  admin: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
  CSR: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
  IT: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100',
  Sales: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
  Finance: 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100',
  Manager: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
  Supervisor: 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100',
};

export default function RolePermissions() {
  const [permissions, setPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState('admin');
  const [expandedSections, setExpandedSections] = useState({ pages: true, features: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Permission.list();
      setPermissions(data || []);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPermission = (role, resourceType, resourceName) => {
    return permissions.find(
      p => p.role === role && p.resource_type === resourceType && p.resource_name === resourceName
    );
  };

  const togglePermission = async (role, resourceType, resourceName, label) => {
    const perm = getPermission(role, resourceType, resourceName);
    const newAccess = !perm?.has_access ?? true;

    try {
      setSaving(true);
      if (perm) {
        await base44.entities.Permission.update(perm.id, { has_access: newAccess });
      } else {
        await base44.entities.Permission.create({
          role,
          resource_type: resourceType,
          resource_name: resourceName,
          resource_label: label,
          has_access: newAccess,
        });
      }
      await loadPermissions();
    } catch (error) {
      console.error('Failed to update permission:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
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

      {/* Role Selector */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Select Role
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {ROLES.map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
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
        </CardContent>
      </Card>

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
                    <span className="font-medium text-sm">{page.label}</span>
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
                    <span className="font-medium text-sm">{feature.label}</span>
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