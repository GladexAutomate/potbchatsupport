import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Ticket, CheckCircle, ChevronRight, Bot, Loader2, ShieldCheck, Upload, X, FileText, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import StaffLoginModal from '@/components/StaffLoginModal';

export default function CustomerPortal() {
  const [view, setView] = useState('home'); // home | chat | ticket | success
  const [chatConfig, setChatConfig] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticketNum, setTicketNum] = useState('');
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ customer_name: '', subject: '', description: '' });
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [employeeRecord, setEmployeeRecord] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);

  useEffect(() => {
    base44.entities.ChatbotConfig.list().then(configs => {
      if (configs?.[0]) setChatConfig(configs[0]);
    }).catch(() => {});
    base44.auth.me().then(async u => {
      if (u) {
        setUser(u);
        setForm(f => ({ ...f, customer_name: u.full_name || '' }));
        // Check if this email is a staff employee
        const employees = await base44.entities.EmployeeAccount.filter({ email: u.email }).catch(() => []);
        if (employees?.length > 0) {
          setEmployeeRecord(employees[0]);
        }
      }
    }).catch(() => {});
  }, []);

  const handleStaffLoginClick = () => {
    // Allow direct access for admin and staff users; only require verification for non-POTB employees
    if (user?.role === 'admin' || (user?.role && ['csr', 'it', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'tl_management'].includes(user.role))) {
      window.location.href = '/dashboard';
    } else if (employeeRecord) {
      setShowStaffModal(true);
    } else {
      window.location.href = '/dashboard';
    }
  };

  const generateTicketNumber = () => {
    const now = new Date();
    return `TKT-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`;
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
    if (!form.customer_name || !form.subject || !form.description) return;
    setSubmitting(true);
    const num = generateTicketNumber();
    const deadline = new Date(Date.now() + 24 * 3600000); // default 24h SLA, CSR will update priority
    
    // Check if customer is VIP
    let isVIP = false;
    if (user?.email) {
      const vipList = await base44.entities.VIPCustomer.filter({ email: user.email });
      isVIP = vipList && vipList.length > 0;
    }
    
    await base44.entities.Ticket.create({
      customer_name: form.customer_name,
      customer_email: user?.email || '',
      subject: form.subject,
      description: form.description,
      attachments: attachments.map(a => a.url),
      ticket_number: num,
      status: 'Open',
      priority: 'Medium',
      source: 'Customer Portal',
      sla_deadline: deadline.toISOString(),
      escalated: false,
      is_vip: isVIP,
    });
    setTicketNum(num);
    setSubmitting(false);
    setView('success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-sora font-bold text-white text-lg">LakbayHub</span>
          <span className="text-white/40 text-sm ml-2">Support</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/my-tickets">
            <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 gap-2">
              <ClipboardList className="w-4 h-4" /> My Tickets
            </Button>
          </Link>
          {employeeRecord && (
            <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 gap-2" onClick={handleStaffLoginClick}>
              <ShieldCheck className="w-4 h-4" /> Staff Login
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <AnimatePresence mode="wait">

          {/* Home */}
          {view === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl text-center">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Support Available 24/7
                </div>
                <h1 className="font-sora text-4xl md:text-5xl font-bold text-white mb-3">
                  How can we <span className="text-primary">help you</span>?
                </h1>
                <p className="text-white/50 text-lg">Get instant answers or connect with our support team.</p>
              </div>

              <div className="grid md:grid-cols-1 gap-4 mb-4 max-w-sm mx-auto w-full">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setView('chat')}
                  className="group bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 rounded-2xl p-6 text-left transition-all">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                    <Bot className="w-6 h-6 text-primary group-hover:text-white" />
                  </div>
                  <h3 className="font-sora font-semibold text-white text-lg mb-2">AI Chat Support</h3>
                  <p className="text-white/50 text-sm">Get instant answers to FAQs. Available 24/7 with no wait time.</p>
                  <div className="flex items-center gap-1 mt-4 text-primary text-sm font-medium">
                    Start chatting <ChevronRight className="w-4 h-4" />
                  </div>
                </motion.button>
              </div>


            </motion.div>
          )}

          {/* AI Chat */}
          {view === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <Button variant="ghost" size="sm" onClick={() => setView('home')} className="text-white/60 hover:text-white">
                  ← Back
                </Button>
                <h2 className="font-sora font-semibold text-white">AI Chat Support</h2>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden" style={{ height: '70vh' }}>
                {chatConfig?.embed_url ? (
                  <iframe src={chatConfig.embed_url} className="w-full h-full border-0" title="AI Support Chat" allow="microphone" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <Bot className="w-16 h-16 text-primary/30 mb-4" />
                    <p className="text-white/60 font-medium mb-2">AI Chat not configured</p>
                    <p className="text-white/30 text-sm mb-6">An admin needs to set up the chatbot embed URL first.</p>
                  </div>
                )}
              </div>

            </motion.div>
          )}

          {/* Ticket Form */}
          {view === 'ticket' && (
            <motion.div key="ticket-form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-xl">
              <div className="flex items-center gap-3 mb-4">
                <Button variant="ghost" size="sm" onClick={() => setView('home')} className="text-white/60 hover:text-white">
                  ← Back
                </Button>
                <h2 className="font-sora font-semibold text-white">Submit a Support Ticket</h2>
              </div>
              <Card className="bg-white/5 border-white/10 backdrop-blur">
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">Full Name *</Label>
                    <Input placeholder="Your name" value={form.customer_name}
                      onChange={e => setForm({...form, customer_name: e.target.value})}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
                  </div>
                  {user?.email && (
                    <div className="text-xs text-white/40 -mt-2">Submitting as <span className="text-primary">{user.email}</span></div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">Subject *</Label>
                    <Input placeholder="Brief subject of your concern" value={form.subject}
                      onChange={e => setForm({...form, subject: e.target.value})}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-xs">Description *</Label>
                    <Textarea placeholder="Describe your concern in detail..." value={form.description}
                      onChange={e => setForm({...form, description: e.target.value})}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30 min-h-[100px]" />
                  </div>

                  {/* Attachments */}
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

                  <Button onClick={handleSubmitTicket} disabled={submitting || uploading} className="w-full bg-primary hover:bg-primary/90">
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : 'Submit Ticket'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Success */}
          {view === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="font-sora text-2xl font-bold text-white mb-2">Ticket Submitted!</h2>
              <p className="text-white/50 mb-4">Our CSR team will review and assign your ticket shortly.</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <p className="text-white/40 text-xs mb-1">Ticket Reference</p>
                <p className="font-mono text-primary font-semibold text-lg">{ticketNum}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <Link to="/my-tickets">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">View My Tickets</Button>
                </Link>
                <Button onClick={() => { setView('home'); setForm({ customer_name: user?.full_name||'', subject:'', description:'' }); setAttachments([]); }}
                  className="bg-primary hover:bg-primary/90">Back to Home</Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <StaffLoginModal
        open={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        employeeRecord={employeeRecord}
      />
    </div>
  );
}