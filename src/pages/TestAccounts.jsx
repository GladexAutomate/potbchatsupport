import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Shield } from 'lucide-react';
import { useState } from 'react';

const STAFF_ROLES = ['csr', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'admin', 'tl_management'];

const ROLE_LABEL = {
  csr: 'CSR / L1 Support',
  sales: 'Sales',
  accounting: 'Accounting',
  sign_ups: 'Sign-Ups',
  on_boarding: 'On-Boarding',
  corp_training: 'Corp / Training',
  admin: 'Admin',
  tl_management: 'TL / Management',
};

const ROLE_COLOR = {
  csr: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  sales: 'bg-green-500/10 text-green-400 border-green-500/20',
  accounting: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  sign_ups: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  on_boarding: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  corp_training: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
  tl_management: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function TestAccounts() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(null);

  // Only super_admin can access this page
  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-muted-foreground">Access denied. Only super admins can view test accounts.</p>
        </div>
      </div>
    );
  }

  const testAccounts = STAFF_ROLES.map(role => ({
    role,
    email: `test-${role}@test.com`,
    label: ROLE_LABEL[role],
  }));

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-bold">Test Accounts</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Login with any of these test accounts to test different roles</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Available Test Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {testAccounts.map(account => (
              <div key={account.role} className="flex items-center justify-between gap-4 p-4 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs border ${ROLE_COLOR[account.role]}`}>{account.label}</Badge>
                  </div>
                  <code className="text-sm font-mono text-foreground">{account.email}</code>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(account.email, account.role)}
                  className="gap-1.5 shrink-0"
                >
                  {copied === account.role ? (
                    <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copy</>
                  )}
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-600">
              💡 <strong>Tip:</strong> You can use any email from these accounts to log in with the corresponding role. Use them to test different features and workflows.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}