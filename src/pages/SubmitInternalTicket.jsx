import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Loader2, ShieldCheck, Upload, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function SubmitInternalTicket() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [view, setView] = useState('form');
  const [submitting, setSubmitting] = useState(false);
  const [ticketNum, setTicketNum] = useState('');
  const [user, setUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ from_department: '', to_department: '', subject: '', description: '' });
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const departmentList = ['Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'];
  const isTLOrAdmin = authUser && ['super_admin', 'tl_management'].includes(authUser.role);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const u = await base44.auth.me();
        if (u) {
          setUser(u);
          // Get user's department from StaffDirectory
          const staffRecords = await db.StaffDirectory.filter({ email: u.email });
          if (staffRecords && staffRecords.length > 0) {
            const role = staffRecords[0].current_role;
            // Map role to department: csr/sales → Sales, it → IT, accounting → Accounting, etc.
            const deptMap = {
              'csr': 'Sales', 'sales': 'Sales', 'it': 'IT', 'accounting': 'Accounting',
              'sign_ups': 'Sign-Ups', 'on_boarding': 'On-Boarding', 'corp_training': 'Corp/Training',
              'admin': 'Admin', 'tl_management': 'TL/Management'
            };
            const dept = deptMap[role?.toLowerCase()];
            if (dept && departmentList.includes(dept)) {
              setForm(f => ({ ...f, from_department: dept }));
            }
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        navigate('/');
      }
    };
    checkAuth();
  }, [navigate]);

  const generateTicketNumber = () => {
    const now = new Date();
    return `INT-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`;
  };

  const handleFiles = async (files) => {
    const remaining = 5 - attachments.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (!toUpload.length) return;
    setUploading(true);
    for (const file of toUpload) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAttachments(prev => [...prev, { name: file.name, url: file_url }]);
    }
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmitTicket = async () => {
    if (!form.from_department || !form.to_department || !form.subject || !form.description) return;
    setSubmitting(true);
    const num = generateTicketNumber();
    const now = new Date().toISOString();
    
    await db.InternalTicket.create({
      ticket_number: num,
      from_department: form.from_department,
      to_department: form.to_department,
      subject: form.subject,
      description: form.description,
      created_by_email: user?.email || '',
      created_by_name: user?.full_name || '',
      attachments: attachments.map(a => a.url),
      status: 'Open',
      priority: 'Medium',
      escalated: false,
    });
    
    setTicketNum(num);
    setSubmitting(false);
    setView('success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col">
      <header className="flex items-center gap-3 px-6 py-4">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-sora font-bold text-white text-lg">LakbayHub</span>
          <span className="text-white/40 text-sm ml-2">Internal Tickets</span>
        </div>
        <div className="ml-auto text-white/50 text-sm">{user?.full_name}</div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {view === 'form' && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-xl">
              <h2 className="font-sora font-semibold text-white text-xl mb-4">Submit Internal Ticket</h2>
              <Card className="bg-white/5 border-white/10 backdrop-blur">
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">From Department *</Label>
                    {isTLOrAdmin ? (
                      <Select value={form.from_department} onValueChange={val => setForm({...form, from_department: val})}>
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Select department..." />
                        </SelectTrigger>
                        <SelectContent>
                          {departmentList.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={form.from_department} disabled
                        className="bg-white/10 border-white/20 text-white/70" />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">To Department *</Label>
                    <Select value={form.to_department} onValueChange={val => setForm({...form, to_department: val})}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Select department..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentList.filter(d => d !== form.from_department).map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">Subject *</Label>
                    <Input placeholder="Brief subject" value={form.subject}
                      onChange={e => setForm({...form, subject: e.target.value})}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">Description *</Label>
                    <Textarea placeholder="Describe the issue in detail..." value={form.description}
                      onChange={e => setForm({...form, description: e.target.value})}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30 min-h-[100px]" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/70 text-xs">Attachments <span className="text-white/30">(max 5 files)</span></Label>
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => attachments.length < 5 && fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                        dragOver ? 'border-primary bg-primary/10' : 'border-white/20 hover:border-white/40'
                      } ${attachments.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {uploading ? (
                        <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Upload className="w-6 h-6 text-white/30" />
                          <p className="text-white/50 text-sm">
                            {attachments.length >= 5 ? 'Maximum 5 files reached' : 'Drag & drop files or click to upload'}
                          </p>
                        </div>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" multiple className="hidden"
                      onChange={e => handleFiles(e.target.files)} />
                    {attachments.length > 0 && (
                      <div className="space-y-1.5">
                        {attachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                            <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-white/70 text-xs truncate flex-1">{att.name}</span>
                            <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                              <X className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button onClick={handleSubmitTicket} 
                    disabled={submitting || uploading || !form.from_department || !form.to_department || !form.subject || !form.description}
                    className="w-full bg-primary hover:bg-primary/90">
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : 'Submit Ticket'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {view === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="font-sora text-2xl font-bold text-white mb-2">Ticket Submitted!</h2>
              <p className="text-white/50 mb-4">Your internal ticket has been created successfully.</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <p className="text-white/40 text-xs mb-1">Ticket Reference</p>
                <p className="font-mono text-primary font-semibold text-lg">{ticketNum}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate('/dashboard')} className="border-white/20 text-white hover:bg-white/10">
                  Back to Dashboard
                </Button>
                <Button onClick={() => { setView('form'); setForm({...form, subject:'', description:'', to_department:''}); setAttachments([]); }}
                  className="bg-primary hover:bg-primary/90">Submit Another</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}