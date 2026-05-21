import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Loader2, Paperclip, X, FileText, Search, MessageSquare, User, ChevronLeft, ArrowRightLeft, MessageSquareText, Tag } from 'lucide-react';
import RerouteTicketModal from '@/components/RerouteTicketModal';
import { formatDistanceToNow } from 'date-fns';

const toPHTime = (dateStr) => {
  const date = new Date(dateStr);
  // Add 8 hours offset for PH time (UTC+8)
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
};

const formatPHTime = (dateStr) => {
  const d = toPHTime(dateStr);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${month} ${day}, ${hours}:${mins}`;
};
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';

const STATUS_COLOR = {
  'Open': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Pending Department': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Resolved': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Closed': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const PRIORITY_COLOR = {
  'Low': 'bg-slate-500/10 text-slate-400',
  'Medium': 'bg-blue-500/10 text-blue-400',
  'High': 'bg-amber-500/10 text-amber-400',
  'Critical': 'bg-red-500/10 text-red-500',
};

export default function StaffMessenger({ tickets, loading }) {
  const { user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  // unread: ticketId -> count of unread customer messages
  const [unread, setUnread] = useState({});
  const [lastSeenMap, setLastSeenMap] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [allMessages, setAllMessages] = useState([]);
  const [rerouteOpen, setRerouteOpen] = useState(false);
  const [savedReplies, setSavedReplies] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [ticketTags, setTicketTags] = useState({}); // ticketId -> [tagNames]
  const [showReplyPicker, setShowReplyPicker] = useState(false);
  const [replySearch, setReplySearch] = useState('');
  const replyPickerRef = useRef(null);

  // Load saved replies and tags once
  useEffect(() => {
    base44.entities.SavedReply.list('-created_date', 200).then(d => setSavedReplies(d || []));
    base44.entities.ConversationTag.filter({ is_active: true }, 'name', 100).then(d => setAllTags(d || []));
  }, []);

  // Close reply picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (replyPickerRef.current && !replyPickerRef.current.contains(e.target)) {
        setShowReplyPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load all messages once for unread badge computation
  useEffect(() => {
    base44.entities.TicketMessage.list('-created_date', 500).then(msgs => {
      setAllMessages(msgs || []);
    });
    const unsub = base44.entities.TicketMessage.subscribe(() => {
      base44.entities.TicketMessage.list('-created_date', 500).then(msgs => {
        setAllMessages(msgs || []);
      });
    });
    return () => unsub();
  }, []);

  // Compute unread counts: customer messages that staff hasn't replied after
  useEffect(() => {
    const counts = {};
    tickets.forEach(t => {
      const tMsgs = allMessages.filter(m => m.ticket_id === t.id);
      if (!tMsgs.length) return;
      const sorted = [...tMsgs].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const lastStaffReply = sorted.filter(m => m.sender_role === 'staff').pop();
      const customerMsgsAfterStaff = sorted.filter(m => {
        const isCustomer = m.sender_role === 'customer';
        if (!lastStaffReply) return isCustomer;
        return isCustomer && new Date(m.created_date) > new Date(lastStaffReply.created_date);
      });
      const lastSeen = lastSeenMap[t.id];
      const unseenCustomer = lastSeen
        ? customerMsgsAfterStaff.filter(m => new Date(m.created_date) > new Date(lastSeen))
        : customerMsgsAfterStaff;
      if (unseenCustomer.length > 0) counts[t.id] = unseenCustomer.length;
    });
    setUnread(counts);
  }, [allMessages, tickets, lastSeenMap]);

  // Load messages for selected ticket
  useEffect(() => {
    if (!selectedTicket) return;
    loadMessages(selectedTicket.id);
    setLastSeenMap(prev => ({ ...prev, [selectedTicket.id]: new Date().toISOString() }));
    const unsub = base44.entities.TicketMessage.subscribe(event => {
      if (event.data?.ticket_id === selectedTicket.id) {
        loadMessages(selectedTicket.id);
        setLastSeenMap(prev => ({ ...prev, [selectedTicket.id]: new Date().toISOString() }));
      }
    });
    return () => unsub();
  }, [selectedTicket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (ticketId) => {
    const msgs = await base44.entities.TicketMessage.filter({ ticket_id: ticketId }, 'created_date');
    setMessages(msgs || []);
  };

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setMessages([]);
    setNewMessage('');
    setAttachments([]);
    setShowReplyPicker(false);
    loadTicketTags(ticket);
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
    await base44.entities.TicketMessage.create({
      ticket_id: selectedTicket.id,
      sender_email: user?.email || '',
      sender_name: user?.full_name || user?.email || 'Support',
      sender_role: 'staff',
      message: newMessage.trim(),
      attachments: attachments.map(a => a.url),
    });
    setNewMessage('');
    setAttachments([]);
    await loadMessages(selectedTicket.id);
    setLastSeenMap(prev => ({ ...prev, [selectedTicket.id]: new Date().toISOString() }));
    setSending(false);
  };

  const toggleTag = async (ticketId, tagName) => {
    const current = ticketTags[ticketId] || [];
    const updated = current.includes(tagName)
      ? current.filter(t => t !== tagName)
      : [...current, tagName];
    setTicketTags(prev => ({ ...prev, [ticketId]: updated }));
    await base44.entities.Ticket.update(ticketId, { tags: updated });
  };

  // Load ticket tags when ticket selected
  const loadTicketTags = async (ticket) => {
    setTicketTags(prev => ({ ...prev, [ticket.id]: ticket.tags || [] }));
  };

  const filteredReplies = savedReplies.filter(r =>
    !replySearch ||
    r.shortcut?.toLowerCase().includes(replySearch.toLowerCase()) ||
    r.message?.toLowerCase().includes(replySearch.toLowerCase())
  );

  const filteredTickets = tickets.filter(t => {
    const matchSearch = !search
      || t.subject?.toLowerCase().includes(search.toLowerCase())
      || t.customer_name?.toLowerCase().includes(search.toLowerCase())
      || t.ticket_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Sort: unread first, then by date
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const aUnread = unread[a.id] || 0;
    const bUnread = unread[b.id] || 0;
    if (aUnread !== bUnread) return bUnread - aUnread;
    return new Date(b.created_date) - new Date(a.created_date);
  });

  return (
    <>
    <div className="flex h-[calc(100vh-120px)] bg-background rounded-xl border border-border/50 overflow-hidden">
      {/* LEFT PANEL - Ticket List */}
      <div className={`flex flex-col border-r border-border/50 bg-card ${selectedTicket ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-shrink-0`}>
        {/* Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-sora font-bold text-lg">Tickets</h2>
            {Object.keys(unread).length > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {Object.values(unread).reduce((a, b) => a + b, 0)} unread
              </span>
            )}
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['All','Open','In Progress','Pending Department','Resolved','Closed'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ticket list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : sortedTickets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No tickets found</div>
          ) : sortedTickets.map(t => {
            const hasUnread = unread[t.id] > 0;
            const isSelected = selectedTicket?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleSelectTicket(t)}
                className={`w-full text-left px-4 py-3.5 border-b border-border/30 transition-colors relative
                  ${isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/40'}
                  ${hasUnread ? 'bg-red-500/5' : ''}
                `}
              >
                {/* Unread blinking dot */}
                {hasUnread && !isSelected && (
                  <span className="absolute top-3.5 right-3 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_2px_rgba(239,68,68,0.5)]" />
                )}
                <div className="flex items-start gap-2.5 pr-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                    ${hasUnread ? 'bg-red-100 text-red-500' : 'bg-muted text-muted-foreground'}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[t.priority] || ''}`}>{t.priority}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[t.status] || ''}`}>{t.status}</span>
                      {hasUnread && (
                        <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-bounce">
                          {unread[t.id]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm truncate max-w-[160px] ${hasUnread ? 'font-bold text-foreground' : 'font-medium'}`}>
                        {t.customer_name}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1 flex-shrink-0">
                        {formatDistanceToNow(toPHTime(t.updated_date || t.created_date), { addSuffix: false })}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${hasUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {t.subject}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL - Chat */}
      <div className={`flex-1 flex flex-col min-w-0 ${selectedTicket ? 'flex' : 'hidden md:flex'}`}>
        {!selectedTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Select a ticket to start chatting</p>
            <p className="text-sm mt-1 opacity-70">Reply to customers in real-time</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-5 py-3.5 border-b border-border/50 bg-card flex items-center gap-3">
              <button className="md:hidden mr-1 text-muted-foreground" onClick={() => setSelectedTicket(null)}>
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary`}>
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate">{selectedTicket.customer_name}</h3>
                  <span className="font-mono text-xs text-muted-foreground hidden sm:block">{selectedTicket.ticket_number}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{selectedTicket.subject}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedTicket.priority && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[selectedTicket.priority]}`}>{selectedTicket.priority}</span>
                )}
                <Badge className={`text-xs border ${STATUS_COLOR[selectedTicket.status] || ''}`}>{selectedTicket.status}</Badge>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 px-2.5" onClick={() => setRerouteOpen(true)}>
                  <ArrowRightLeft className="w-3 h-3" /> Reroute
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-muted/10">
              {messages.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No messages yet. Start the conversation.</p>
              )}
              <AnimatePresence>
                {messages.map(msg => {
                  const isStaff = msg.sender_role === 'staff';
                  return (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-2.5 ${isStaff ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold
                        ${isStaff ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {isStaff ? (user?.full_name?.[0] || 'S') : (selectedTicket.customer_name?.[0] || 'C')}
                      </div>
                      <div className={`max-w-[70%] flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}>
                        <p className="text-xs text-muted-foreground mb-1 px-1">
                          {isStaff ? (msg.sender_name || 'Staff') : (msg.sender_name || 'Customer')}
                        </p>
                        <div className={`rounded-2xl px-4 py-2.5 shadow-sm
                          ${isStaff
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-card border border-border/50 rounded-tl-sm'
                          }`}>
                          {msg.message && <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>}
                          {msg.attachments?.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {msg.attachments.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs opacity-80 hover:opacity-100 underline">
                                  <FileText className="w-3 h-3" /> Attachment {i+1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 px-1">
                          {formatPHTime(msg.created_date)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
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

            {/* Tag Strip — shows applied tags + all tags as toggles */}
            <div className="px-4 pt-2 pb-1 border-t bg-card flex gap-1.5 flex-wrap items-center min-h-[36px]">
              <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {allTags.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">No tags available</span>
              ) : allTags.map(tag => {
                const active = (ticketTags[selectedTicket.id] || []).includes(tag.name);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(selectedTicket.id, tag.name)}
                    title={active ? `Remove "${tag.name}"` : `Apply "${tag.name}"`}
                    className={`text-xs px-2 py-0.5 rounded font-semibold transition-all border ${
                      active
                        ? 'text-white border-transparent'
                        : 'bg-muted/50 text-muted-foreground border-border/40 hover:border-border hover:text-foreground opacity-50 hover:opacity-100'
                    }`}
                    style={active ? { background: tag.color || '#6366f1', borderColor: tag.color || '#6366f1' } : {}}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>

            {/* Input */}
            <div className="p-4 pt-2 bg-card flex items-end gap-2 relative">
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
                placeholder="Type a reply..."
                className="flex-1 rounded-full bg-muted border-0 focus-visible:ring-1"
              />

              {/* Quick Reply Picker */}
              <div className="relative shrink-0" ref={replyPickerRef}>
                <button
                  onClick={() => { setShowReplyPicker(v => !v); setReplySearch(''); }}
                  className={`p-1.5 rounded-lg transition-colors ${showReplyPicker ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  title="Quick Replies"
                >
                  <MessageSquareText className="w-4 h-4" />
                </button>
                {showReplyPicker && (
                  <div className="absolute bottom-10 right-0 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-border/50">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          autoFocus
                          placeholder="Search shortcuts..."
                          value={replySearch}
                          onChange={e => setReplySearch(e.target.value)}
                          className="pl-8 h-7 text-xs"
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {filteredReplies.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-6">No saved replies found</p>
                      ) : filteredReplies.map(r => (
                        <button
                          key={r.id}
                          onClick={() => { setNewMessage(r.message); setShowReplyPicker(false); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/20 last:border-0"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs font-bold text-primary uppercase">{r.shortcut}</span>
                            {r.topic && <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0 rounded-full">{r.topic}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{r.message}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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

    {rerouteOpen && selectedTicket && (
      <RerouteTicketModal
        ticket={selectedTicket}
        onClose={() => setRerouteOpen(false)}
        onSaved={() => loadMessages(selectedTicket.id)}
      />
    )}
    </>
  );
}