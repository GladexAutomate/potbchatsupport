import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

export default function StaffLoginModal({ open, onClose, employeeRecord }) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setError('');
    if (!employeeCode.trim() || !password.trim()) {
      setError('Please enter both Employee Code and Password.');
      return;
    }
    setLoading(true);

    const codeMatch = employeeCode.trim().toUpperCase() === (employeeRecord?.employee_code || '').toUpperCase();
    const passMatch = password.trim() === (employeeRecord?.generated_password || '');

    if (codeMatch && passMatch) {
      // Block explicitly blocked employees
      if (employeeRecord?.is_blocked) {
        setError('Your account has been blocked. Please contact your administrator.');
        setLoading(false);
        return;
      }
      // Block inactive employees
      if (employeeRecord?.status === 'inactive') {
        setError('Your account is inactive. Please contact HR or your administrator.');
        setLoading(false);
        return;
      }
      // Block non-POTB employees unless portal_access_granted
      const isPotb = employeeRecord?.employee_code?.toUpperCase().startsWith('POTB');
      if (!isPotb && !employeeRecord?.portal_access_granted) {
        setError('Access restricted. Only authorized employees can access this portal.');
        setLoading(false);
        return;
      }
      // Credentials valid — redirect to staff dashboard
      window.location.href = '/dashboard';
    } else {
      setError('Invalid Employee Code or Password. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Staff Verification
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Enter your Employee Code and HR-issued Password to access the staff portal.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground">
            Logged in as: <span className="font-medium text-foreground">{employeeRecord?.full_name || employeeRecord?.email}</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Employee Code</Label>
            <Input
              placeholder="e.g. POTB2024-0096"
              value={employeeCode}
              onChange={e => setEmployeeCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              placeholder="HR-issued password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleVerify} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Verify & Enter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}