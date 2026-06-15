import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

export default function EmailLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Check if email exists in EmployeeAccount
      const employees = await base44.entities.EmployeeAccount.filter({ email }).catch(() => []);
      
      if (employees && employees.length > 0) {
        // Employee - redirect to Base44 login with email
        base44.auth.redirectToLogin(`/dashboard?type=employee&email=${encodeURIComponent(email)}`);
      } else {
        // Customer - redirect to Base44 login with email
        base44.auth.redirectToLogin(`/?type=customer&email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center mb-12">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="ml-3">
            <span className="font-sora font-bold text-white text-xl">LakbayHub</span>
            <span className="text-white/40 text-xs ml-1">Support Portal</span>
          </div>
        </div>

        {/* Login Card */}
        <Card className="bg-white/5 border-white/10 backdrop-blur">
          <CardContent className="p-8">
            <div className="mb-8">
              <h1 className="font-sora text-2xl font-bold text-white mb-2">
                Welcome Back
              </h1>
              <p className="text-white/50 text-sm">
                Enter your email to access your account. We'll identify you as a customer or staff member.
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-white/70 text-sm font-medium mb-2 block">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-primary/50"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full bg-primary hover:bg-primary/90 h-10 text-white font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-white/40 text-xs text-center">
                By logging in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Text */}
        <div className="mt-8 text-center text-white/40 text-xs space-y-1">
          <p>🔒 Secure login powered by LakbayHub</p>
          <p>Your email helps us route you to the right support team</p>
        </div>
      </div>
    </div>
  );
}