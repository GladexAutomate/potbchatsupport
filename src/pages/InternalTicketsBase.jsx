import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Loader2, Paperclip, X, FileText, Search, MessageSquare, User, ChevronLeft, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';

const STATUS_COLOR = {
  'Open': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Pending': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Resolved': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Closed': 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

const PRIORITY_COLOR = {
  'Low': 'bg-slate-500/10 text-slate-400',
  'Medium': 'bg-blue-500/10 text-blue-400',
  'High': 'bg-amber-500/10 text-amber-400',
  'Critical': 'bg-red-500/10 text-red-500'
};

const departmentList = ['Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'];

export default function InternalTicketsBase({ userDepartment }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [slaPolicies, setSlaPolicies] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Check role-based access — all staff roles can view their department's internal tickets
  const hasAccess = user && ['super_admin', 'admin', 'tl_management', 'csr', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training', 'it'].includes(user.role);

  useEffect(() => {
    loadData();
    loadSLAPolicies();
  }, []);

  const loadSLAPolicies = async () => {
    try {
      const policies = await db.SLAPolicy.list();
      setSlaPolicies(policies || []);
    } catch (err) {
      console.error('Error loading SLA policies:', err);
    }
  };

  const loadData = async () => {
    try {
      const created = await db.InternalTicket.filter({ from_department: userDepartment });
      const assigned = await db.InternalTicket.filter({ to_department: userDepartment });
      
      const allTickets = [...(created || []), ...(assigned || [])];
      const uniqueTickets = Array.from(new Map(allTickets.map(t => [t.id, t])).values());
      setTickets(uniqueTickets.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (err) {
      console.error('Error loading tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setMessages([]);
    setNewMessage('');
    setAttachments([]);
  };

  const handleFileUpload = async (files) => {
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

  const handleSend = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    setSending(true);
    await db.InternalTicket.update(selectedTicket.id, {
      notes: (selectedTicket.notes ? selectedTicket.notes + '\n\n' : '') + 
             `[${new Date().toLocaleString()}] ${user?.full_name}: ${newMessage.trim()}`
    });
    setSelectedTicket(prev => ({
      ...prev,
      notes: (prev.notes ? prev.notes + '\n\n' : '') + 
             `[${new Date().toLocaleString()}] ${user?.full_name}: ${newMessage.trim()}`
    }));
    setNewMessage('');
    setAttachments([]);
    await loadData();
    setSending(false);
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch = !search
      || t.subject?.toLowerCase().includes(search.toLowerCase())
      || t.ticket_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const createdTickets = filteredTickets.filter(t => t.from_department === userDepartment);
  const assignedTickets = filteredTickets.filter(t => t.to_department === userDepartment);

  const isImageUrl = (url) => /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);

  const getTicketSLAStatus = (ticket) => {
    const policy = slaPolicies.find(p => p.priority === ticket.priority);
    if (!policy) return { isBreached: false, timeRemaining: null };

    const now = new Date();
    const createdAt = new Date(ticket.created_date);
    const elapsedHours = (now - createdAt) / (1000 * 60 * 60);

    const threshold = ticket.status === 'Open' ? policy.response_time_hours : policy.resolution_time_hours;
    const isBreached = elapsedHours > threshold;

    return { isBreached, timeRemaining: Math.max(0, threshold - elapsedHours) };
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-sm text-center">
          <CardContent className="p-8">
            <p className="text-destructive font-semibold mb-2">Access Denied</p>
            <p className="text-sm text-muted-foreground">Only TL/Management and Super Admins can view internal tickets.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 bg-background rounded-xl border border-border/50 overflow-hidden h-screen">
      {/* LEFT PANEL - Ticket List */}
      <div className={`flex flex-col border-r border-border/50 bg-card ${selectedTicket ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-shrink-0`}>
        {/* Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-sora font-bold text-lg">Internal Tickets</h2>
            <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => navigate('/submit-internal-ticket')}>
              <Plus className="w-3.5 h-3.5" /> Create
            </Button>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {['All', 'Open', 'In Progress', 'Pending', 'Resolved', 'Closed'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ticket List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : createdTickets.length === 0 && assignedTickets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No tickets found</div>
          ) : (
            <>
              {createdTickets.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/50 border-b border-border/30">
                    <span className="text-xs font-semibold text-muted-foreground">Created by {userDepartment}</span>
                  </div>
                  {createdTickets.map(t => {
                    const slaStatus = getTicketSLAStatus(t);
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTicket(t)}
                        className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-muted/50 transition-colors ${
                          selectedTicket?.id === t.id ? 'bg-primary/10' : ''
                        } ${slaStatus.isBreached ? 'bg-red-500/5' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className={`font-mono text-xs ${slaStatus.isBreached ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                            {slaStatus.isBreached && '🚨 '}{t.ticket_number}
                          </div>
                          <Badge className={`text-xs border ${STATUS_COLOR[t.status]}`}>{t.status}</Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                        <p className="text-xs text-muted-foreground mt-1">→ {t.to_department}</p>
                      </button>
                    );
                  })}
                </>
              )}
              {assignedTickets.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/50 border-b border-border/30">
                    <span className="text-xs font-semibold text-muted-foreground">Assigned to {userDepartment}</span>
                  </div>
                  {assignedTickets.map(t => {
                    const slaStatus = getTicketSLAStatus(t);
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTicket(t)}
                        className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-muted/50 transition-colors ${
                          selectedTicket?.id === t.id ? 'bg-primary/10' : ''
                        } ${slaStatus.isBreached ? 'bg-red-500/5' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className={`font-mono text-xs ${slaStatus.isBreached ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                            {slaStatus.isBreached && '🚨 '}{t.ticket_number}
                          </div>
                          <Badge className={`text-xs border ${STATUS_COLOR[t.status]}`}>{t.status}</Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                        <p className="text-xs text-muted-foreground mt-1">← from {t.from_department}</p>
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - Chat */}
      <div className={`flex-1 flex flex-col min-w-0 ${selectedTicket ? 'flex' : 'hidden md:flex'}`}>
        {!selectedTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Select a ticket to view details</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-border/50 bg-card flex items-center gap-3">
              <button className="md:hidden mr-1 text-muted-foreground" onClick={() => setSelectedTicket(null)}>
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate">{selectedTicket.ticket_number}</h3>
                  <Badge className={`text-xs border ${STATUS_COLOR[selectedTicket.status]}`}>{selectedTicket.status}</Badge>
                  <Badge className={`text-xs border ${PRIORITY_COLOR[selectedTicket.priority]}`}>{selectedTicket.priority}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{selectedTicket.subject}</p>
              </div>
            </div>

            {/* Details Card */}
            <div className="px-5 py-3 bg-muted/10 border-b border-border/30">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">From</p>
                  <p className="font-semibold">{selectedTicket.from_department}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">To</p>
                  <p className="font-semibold">{selectedTicket.to_department}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Created by</p>
                  <p className="font-semibold">{selectedTicket.created_by_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Date</p>
                  <p className="font-semibold">{formatDistanceToNow(new Date(selectedTicket.created_date), { addSuffix: true })}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Description</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {selectedTicket.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Internal Notes</p>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap font-mono">{selectedTicket.notes}</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Attachment preview */}
            {attachments.length > 0 && (
              <div className="px-4 pb-2 pt-2 flex gap-2 flex-wrap border-t bg-card">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5">
                    <FileText className="w-3 h-3 text-primary" />
                    <span className="text-xs max-w-[100px] truncate">{att.name}</span>
                    <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                      <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 pt-2 flex items-end gap-2 bg-card border-t border-border/50">
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="text-muted-foreground hover:text-foreground p-1.5 shrink-0 rounded-lg hover:bg-muted transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={e => handleFileUpload(e.target.files)} />
              <Input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Add internal note..."
                className="flex-1 rounded-full border-0 focus-visible:ring-1 bg-muted"
              />
              <Button onClick={handleSend}
                disabled={sending || (!newMessage.trim() && attachments.length === 0)}
                size="icon" className="bg-primary hover:bg-primary/90 rounded-full shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}