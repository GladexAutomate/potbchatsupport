import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Shield, Loader2, Lock, Unlock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

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
  const [testAccounts, setTestAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    loadTestAccounts();
  }, []);

  const loadTestAccounts = async () => {
    setLoading(true);
    const accounts = await base44.entities.TestAccount.list('-created_date', 100);
    setTestAccounts(accounts || []);
    setLoading(false);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyBoth = (account) => {
    const formatted = `Emp Code : ${account.employee_code}\nPass : ${account.password}`;
    navigator.clipboard.writeText(formatted);
    setCopied(account.id + '_both');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleToggleEnabled = async (account) => {
    setToggling(account.id);
    await base44.entities.TestAccount.update(account.id, { is_enabled: !account.is_enabled });
    setTestAccounts(prev => prev.map(a => a.id === account.id ? { ...a, is_enabled: !a.is_enabled } : a));
    setToggling(null);
  };

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-bold">Test Accounts</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Login with any enabled test account using the employee code and password</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Available Test Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading test accounts...</div>
          ) : testAccounts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No test accounts created yet</div>
          ) : (
            <div className="space-y-3">
              {testAccounts.map(account => (
                <div
                  key={account.id}
                  className={`flex items-center justify-between gap-4 p-4 border border-border/50 rounded-lg transition-colors ${
                    !account.is_enabled ? 'bg-red-500/5 opacity-60' : 'hover:bg-muted/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`text-xs border ${ROLE_COLOR[account.role]}`}>
                        {ROLE_LABEL[account.role]}
                      </Badge>
                      {!account.is_enabled && (
                        <Badge className="text-xs border bg-red-500/10 text-red-500 border-red-500/20">Disabled</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Employee Code</p>
                        <code className="text-sm font-mono text-foreground font-semibold">{account.employee_code}</code>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Password</p>
                        <code className="text-sm font-mono text-foreground font-semibold">{account.password}</code>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-col sm:flex-row">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyBoth(account)}
                      className="gap-1.5 w-full sm:w-auto"
                    >
                      {copied === account.id + '_both' ? (
                        <><Check className="w-3.5 h-3.5 text-green-500" /> Copied!</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" /> Copy Both</>
                      )}
                    </Button>
                    <Button
                      variant={account.is_enabled ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => handleToggleEnabled(account)}
                      disabled={toggling === account.id}
                      className={`gap-1.5 w-full sm:w-auto ${
                        !account.is_enabled ? 'bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30' : ''
                      }`}
                    >
                      {toggling === account.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : account.is_enabled ? (
                        <><Lock className="w-3.5 h-3.5" /> Disable</>
                      ) : (
                        <><Unlock className="w-3.5 h-3.5" /> Enable</>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-600">
              💡 <strong>Tip:</strong> Use the employee code and password to login. Disabled accounts cannot be used until re-enabled.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}