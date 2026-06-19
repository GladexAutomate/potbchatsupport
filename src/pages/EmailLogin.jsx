import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function EmailLogin() {
  useEffect(() => {
    // Redirect directly to Base44 login - no need for email form
    base44.auth.redirectToLogin();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
    </div>
  );
}