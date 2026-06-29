import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Loader2, Paperclip, X, FileText, Search, MessageSquare, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { usePolling } from '@/lib/usePolling';
import { useNavigate } from 'react-router-dom';
import { formatDateFull, convertOldTimestampFormat, APP_TIMEZONE } from '@/lib/timezone';
import CreateInternalTicketModal from '@/components/CreateInternalTicketModal';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

const STATUS_COLOR = {
  'Open': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Pending': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Resolved': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Closed': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const PRIORITY_COLOR = {
  'Low': 'bg-slate-500/10 text-slate-400',
  'Medium': 'bg-blue-500/10 text-blue-400',
  'High': 'bg-amber-500/10 text-amber-400',
  'Critical': 'bg-red-500/10 text-red-500',
};

// Maps user role → department name used in InternalTicket from/to_department
const ROLE_TO_DEPARTMENT = {
  csr: 'CSR',
  sales: 'Sales',
  it: 'IT',
  accounting: 'Accounting',
  sign_ups: 'Sign-Ups',
  on_boarding: 'On-Boarding',
  corp_training: 'Corp/Training',
  admin: 'Admin',
  tl_management: 'TL/Management',
  super_admin: null, // sees all
};

const ALL_DEPARTMENTS = ['CSR', 'Sales', 'IT', 'Accounting', 'Sign-Ups', 'On-Boarding', 'Corp/Training', 'Admin', 'TL/Management'];

/**
 * The `notes` field stores the whole conversation as one string, each message in
 * the form `[timestamp] Sender Name: message`, entries separated by blank lines.
 * Parse it back into individual messages so we can render a proper chat thread.
 */
function parseInternalMessages(raw) {
  if (!raw) return [];
  const text = convertOldTimestampFormat(raw);
  const entryRe = /^\s*\[([^\]]+)\]\s*([^:]+?):\s*([\s\S]*)$/;
  const messages = [];
  for (const chunk of text.split(/\n\n+/)) {
    if (!chunk.trim()) continue;
    const m = chunk.match(entryRe);
    if (m) {
      messages.push({ time: m[1].trim(), sender: m[2].trim(), text: m[3].trim() });
    } else if (messages.length) {
      // A message that itself contained a blank line — append to the previous one.
      messages[messages.length - 1].text += '\n\n' + chunk.trim();
    } else {
      messages.push({ time: '', sender: '', text: chunk.trim() });
    }
  }
  return messages;
}

export default function InternalTicketsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [slaPolicies, setSlaPolicies] = useState([]);
  const [viewMode, setViewMode] = useState('assigned');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const userDepartment = ROLE_TO_DEPARTMENT[user?.role] ?? null;
  const isTLorSuperAdmin = user?.role === 'super_admin' || user?.role === 'tl_management';

  const isSuperAdmin = isTLorSuperAdmin; // alias for compatibility
  const hasAccess = user && Object.keys(ROLE_TO_DEPARTMENT).includes(user.role);

  useEffect(() => {
    let loadTimer;
    loadData();
    db.SLAPolicy.list().then(d => setSlaPolicies(d || []));

    const unsub = db.InternalTicket.subscribe(() => {
      clearTimeout(loadTimer);
      loadTimer = setTimeout(loadData, 500);
    });
    return () => { clearTimeout(loadTimer); unsub(); };
  }, [user?.role]);

  const loadData = async () => {
    try {
      let allTickets = [];

      if (isTLorSuperAdmin) {
        // TL/Management and super admins see everything
        allTickets = await db.InternalTicket.list('-created_date', 500);
      } else if (userDepartment) {
        // All other roles: see all tickets where their department is from or to
        const [fromDept, toDept] = await Promise.all([
          db.InternalTicket.filter({ from_department: userDepartment }),
          db.InternalTicket.filter({ to_department: userDepartment }),
        ]);
        const merged = [...(fromDept || []), ...(toDept || [])];
        allTickets = Array.from(new Map(merged.map(t => [t.id, t])).values());
      }

      allTickets.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setTickets(allTickets);
      // Keep the open conversation in sync so new messages from other users appear
      // live (the open ticket is a separate snapshot from the list). Only swap when
      // it actually changed, to avoid re-rendering the thread on every poll.
      setSelectedTicket(prev => {
        if (!prev) return prev;
        const fresh = allTickets.find(t => t.id === prev.id);
        if (!fresh) return prev;
        // Notes/attachments are append-only, so the longer one is the more complete
        // version. Keeping the longer of (local, server) prevents a stale read
        // (read-after-write lag) from dropping a message the sender just added
        // optimistically, while still pulling in newer messages from other users.
        const mergedNotes = (fresh.notes?.length || 0) >= (prev.notes?.length || 0)
          ? fresh.notes : prev.notes;
        const mergedAttachments = (fresh.attachments?.length || 0) >= (prev.attachments?.length || 0)
          ? fresh.attachments : prev.attachments;
        const unchanged = mergedNotes === prev.notes
          && fresh.status === prev.status
          && (mergedAttachments?.length || 0) === (prev.attachments?.length || 0);
        return unchanged ? prev : { ...fresh, notes: mergedNotes, attachments: mergedAttachments };
      });
    } catch (err) {
      console.error('Error loading internal tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  // Realtime fallback: poll for new messages/tickets in case the websocket is silent.
  usePolling(loadData, 6000, hasAccess);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.notes]);

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
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
    const base = selectedTicket;
    const zonedDate = toZonedTime(new Date(), APP_TIMEZONE);
    const timestamp = format(zonedDate, 'MMM. d, yyyy, h:mm a');
    const newAttachmentUrls = attachments.map(a => a.url);
    const updatedAttachments = [...(base.attachments || []), ...newAttachmentUrls];
    const updatedNotes = (base.notes ? base.notes + '\n\n' : '') +
      `[${timestamp}] ${user?.full_name}: ${newMessage.trim()}`;

    // Optimistic: show the sender's message instantly, before the network round-trip.
    setSelectedTicket(prev => (prev && prev.id === base.id
      ? { ...prev, notes: updatedNotes, attachments: updatedAttachments } : prev));
    setTickets(prev => prev.map(t => (t.id === base.id
      ? { ...t, notes: updatedNotes, attachments: updatedAttachments } : t)));
    setNewMessage('');
    setAttachments([]);
    setSending(true);

    try {
      await db.InternalTicket.update(base.id, {
        notes: updatedNotes,
        attachments: updatedAttachments,
      });
    } catch (err) {
      console.error('Failed to send internal message:', err);
    } finally {
      setSending(false);
    }
    // Server reconciliation arrives via polling/subscribe; the longer-notes merge in
    // loadData keeps this just-sent message from being dropped by a stale read.
  };

  const handleCloseTicket = async () => {
    setSending(true);
    await db.InternalTicket.update(selectedTicket.id, { status: 'Closed' });
    await db.TicketHistory.create({
      ticket_id: selectedTicket.id,
      event_type: 'status_changed',
      description: 'Internal ticket closed',
      actor: user?.full_name || user?.email || 'Staff',
      old_value: selectedTicket.status,
      new_value: 'Closed',
    });
    setSelectedTicket(prev => ({ ...prev, status: 'Closed' }));
    setSending(false);
    await loadData();
  };

  const getTicketSLAStatus = (ticket) => {
    const policy = slaPolicies.find(p => p.priority === ticket.priority);
    if (!policy) return { isBreached: false };
    const elapsed = (Date.now() - new Date(ticket.created_date)) / 3600000;
    const threshold = ticket.status === 'Open' ? policy.response_time_hours : policy.resolution_time_hours;
    return { isBreached: elapsed > threshold };
  };

  // Build the filtered list based on view mode + filters
  const filteredTickets = tickets.filter(t => {
    const matchSearch = !search
      || t.subject?.toLowerCase().includes(search.toLowerCase())
      || t.ticket_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchDept = deptFilter === 'All'
      || t.from_department === deptFilter
      || t.to_department === deptFilter;

    // View mode filter
    let matchView = true;
    if (!isTLorSuperAdmin && userDepartment) {
      // All non-TL roles: filter by department
      if (viewMode === 'assigned') matchView = t.to_department === userDepartment;
      else matchView = t.from_department === userDepartment;
    }

    return matchSearch && matchStatus && matchDept && matchView;
  });

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-sm text-center">
          <CardContent className="p-8">
            <p className="text-destructive font-semibold mb-2">Access Denied</p>
            <p className="text-sm text-muted-foreground">You do not have access to internal tickets.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 bg-background rounded-xl border border-border/50 overflow-hidden h-screen">
      {/* LEFT PANEL */}
      <div className={`flex flex-col border-r border-border/50 bg-card ${selectedTicket ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-shrink-0`}>
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-sora font-bold text-lg">Internal Tickets</h2>
            <CreateInternalTicketModal onTicketCreated={loadData} />
          </div>

          {/* View mode tabs — only for non-TL/Management */}
          {!isTLorSuperAdmin && (
            <Tabs value={viewMode} onValueChange={setViewMode} className="mb-3 w-full">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="assigned" className="text-xs">Received ({userDepartment})</TabsTrigger>
                <TabsTrigger value="created" className="text-xs">Sent by {userDepartment}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>

          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {['All', 'Open', 'In Progress', 'Pending', 'Resolved', 'Closed'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isTLorSuperAdmin && (
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Dept" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Depts</SelectItem>
                  {ALL_DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Ticket List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No tickets found</div>
          ) : (
            filteredTickets.map(t => {
              const slaStatus = getTicketSLAStatus(t);
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTicket(t)}
                  className={`w-full text-left px-4 py-3 border-b border-border/30 hover:bg-muted/50 transition-colors ${selectedTicket?.id === t.id ? 'bg-primary/10' : ''} ${slaStatus.isBreached ? 'bg-red-500/5' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className={`font-mono text-xs ${slaStatus.isBreached ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                      {slaStatus.isBreached && '🚨 '}{t.ticket_number}
                    </div>
                    <Badge className={`text-xs border ${STATUS_COLOR[t.status]}`}>{t.status}</Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{t.from_department}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="text-xs text-muted-foreground">{t.to_department}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
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
              {selectedTicket.status !== 'Closed' && (
                <Button onClick={handleCloseTicket} disabled={sending} size="sm" variant="outline" className="gap-1.5 text-xs h-8 ml-2">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Close
                </Button>
              )}
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
                  <p className="text-muted-foreground mb-0.5">Date & Time</p>
                  <p className="font-semibold">{formatDateFull(selectedTicket.created_date)}</p>
                </div>
              </div>
            </div>

            {/* Conversation */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-muted/10">
              {(() => {
                // Render the ticket description as the opening message, then the
                // parsed conversation, as messenger-style bubbles.
                const thread = [
                  {
                    time: formatDateFull(selectedTicket.created_date),
                    sender: selectedTicket.created_by_name,
                    text: selectedTicket.description || '',
                  },
                  ...parseInternalMessages(selectedTicket.notes),
                ].filter(m => m.text || m.sender);

                return thread.map((m, i) => {
                  const isMe = m.sender && user?.full_name
                    && m.sender.trim().toLowerCase() === user.full_name.trim().toLowerCase();
                  return (
                    <div key={i} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold
                        ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {(m.sender?.[0] || '?').toUpperCase()}
                      </div>
                      <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <p className="text-xs text-muted-foreground mb-1 px-1">{isMe ? 'You' : (m.sender || 'Unknown')}</p>
                        <div className={`rounded-2xl px-4 py-2.5 shadow-sm
                          ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border/50 rounded-tl-sm'}`}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
                        </div>
                        {m.time && <p className="text-xs text-muted-foreground mt-1 px-1">{m.time}</p>}
                      </div>
                    </div>
                  );
                });
              })()}

              {selectedTicket.attachments?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Attachments</p>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedTicket.attachments.map((url, i) => {
                      const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
                      return isImage ? (
                        <div key={i} className="rounded-lg border border-border overflow-hidden bg-muted">
                          <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-auto max-h-40 object-cover" />
                        </div>
                      ) : (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted bg-card">
                          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-xs truncate">File {i + 1}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Attachment preview */}
            {attachments.length > 0 && (
              <div className="px-4 pb-2 pt-2 border-t bg-card flex gap-2 flex-wrap">
                {attachments.map((att, i) => {
                  const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(att.url);
                  return (
                    <div key={i} className="relative group">
                      {isImage ? (
                        <img src={att.url} alt={att.name} className="h-12 w-12 object-cover rounded-lg border border-border" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg border border-border bg-muted flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Input */}
            {selectedTicket.status === 'Closed' ? (
              <div className="p-4 text-center text-sm text-muted-foreground bg-muted/30 border-t border-border/50">
                This ticket is closed. No further updates allowed.
              </div>
            ) : (
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
                  placeholder="Type a message..."
                  className="flex-1 rounded-full border-0 focus-visible:ring-1 bg-muted"
                />
                <Button onClick={handleSend}
                  disabled={sending || (!newMessage.trim() && attachments.length === 0)}
                  size="icon" className="bg-primary hover:bg-primary/90 rounded-full shrink-0">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}