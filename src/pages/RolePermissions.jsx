import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-poppins font-bold">Role Permissions</h1>
        <p className="text-muted-foreground mt-1">Configure page and feature access for each role</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ROLES.map(role => (
              <Button
                key={role}
                variant={selectedRole === role ? 'default' : 'outline'}
                onClick={() => setSelectedRole(role)}
                className="w-full"
              >
                {role}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('pages')}>
            <CardTitle>Page Access</CardTitle>
            {expandedSections.pages ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </CardHeader>
        {expandedSections.pages && (
          <CardContent className="space-y-4">
            {PAGES.map(page => {
              const perm = getPermission(selectedRole, 'page', page.name);
              const hasAccess = perm?.has_access ?? false;
              return (
                <div key={page.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50">
                  <span className="font-medium">{page.label}</span>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('features')}>
            <CardTitle>Feature Access</CardTitle>
            {expandedSections.features ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </CardHeader>
        {expandedSections.features && (
          <CardContent className="space-y-4">
            {FEATURES.map(feature => {
              const perm = getPermission(selectedRole, 'feature', feature.name);
              const hasAccess = perm?.has_access ?? false;
              return (
                <div key={feature.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50">
                  <span className="font-medium">{feature.label}</span>
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
  );
}