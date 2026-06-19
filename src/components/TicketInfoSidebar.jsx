import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, ChevronRight, ChevronLeft, AlertTriangle, Send, Loader2, Paperclip, X, FileText, History } from 'lucide-react';
import { differenceInMinutes, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const toPHTime = (dateStr) => new Date(new Date(dateStr).getTime() + 8 * 60 * 60 * 1000);

const formatPHTime = (dateStr) => {
  const d = toPHTime(dateStr);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${month} ${day}, ${hours}:${mins}`;
};

const STATUS_OPTIONS = ['Open', 'In Progress', 'Pending Department', 'Resolved'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];

const STATUS_COLOR = {
  'Open': 'text-blue-400',
  'In Progress': 'text-amber-400',
  'Pending Department': 'text-purple-400',
  'Resolved': 'text-green-400',
  'Closed': 'text-slate-400',
};

export default function TicketInfoSidebar({ ticket, onTicketUpdate }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [agents, setAgents] = useState([]);
  const [slaPolicy, setSlaPolicy] = useState(null);
  const [now, setNow] = useState(new Date());
  const [noteText, setNoteText] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const [staffMessages, setStaffMessages] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    db.User.list().then(d => setAgents(d || []));
    db.SLAPolicy.filter({ priority: ticket.priority }).then(d => {
      if (d?.length) setSlaPolicy(d[0]);
    });
  }, [ticket.priority]);

  // Load internal staff messages for this ticket
  useEffect(() => {
    if (!ticket.id) return;
    loadStaffMessages();
    const unsub = db.TicketMessage.subscribe(event => {
      if (event.data?.ticket_id === ticket.id && event.data?.is_internal) {
        loadStaffMessages();
      }
    });
    return () => unsub();
  }, [ticket.id]);

  // Load ticket history
  useEffect(() => {
    if (!ticket.id) return;
    loadHistory();
    const unsub = db.TicketHistory.subscribe(event => {
      if (event.data?.ticket_id === ticket.id) {
        loadHistory();
      }
    });
    return () => unsub();
  }, [ticket.id]);

  const loadHistory = async () => {
    const hist = await db.TicketHistory.filter({ ticket_id: ticket.id }, '-created_date');
    setHistory((hist || []).filter(h => ['status_changed', 'priority_changed', 'assigned'].includes(h.event_type)));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [staffMessages]);

  const loadStaffMessages = async () => {
    const msgs = await db.TicketMessage.filter({ ticket_id: ticket.id, is_internal: true }, 'created_date');
    setStaffMessages(msgs || []);
  };

  const handleFileUpload = async (files) => {
    const toUpload = Array.from(files).slice(0, 5 - attachments.length);
    if (!toUpload.length) return;
    setUploading(true);
    for (const file of toUpload) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAttachments(prev => [...prev, { name: file.name, url: file_url, isImage: file.type.startsWith('image/') }]);
    }
    setUploading(false);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setUploading(true);
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          setAttachments(prev => [...prev, { name: 'pasted-image.png', url: file_url, isImage: true }]);
          setUploading(false);
        }
      }
    }
  };

  // Tick every minute for SLA countdown
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const handleSendNote = async () => {
    if (!noteText.trim() && attachments.length === 0) return;
    setSendingNote(true);
    await db.TicketMessage.create({
      ticket_id: ticket.id,
      sender_email: user?.email || '',
      sender_name: user?.full_name || user?.email || 'Support',
      sender_role: 'staff',
      message: noteText.trim(),
      is_internal: true,
      attachments: attachments.map(a => a.url),
    });
    setNoteText('');
    setAttachments([]);
    setSendingNote(false);
  };

  const handleChange = async (field, value, description, oldValue) => {
    let extraFields = {};
    // When closing/resolving, stop the active SLA entry
    if (field === 'status' && (value === 'Resolved' || value === 'Closed')) {
      const log = [...(ticket.dept_sla_log || [])];
      const activeIdx = log.findIndex(e => e.grade === 'Active');
      if (activeIdx !== -1) {
        const active = log[activeIdx];
        const elapsed = Math.round((Date.now() - new Date(active.started_at).getTime()) / 60000);
        log[activeIdx] = { ...active, stopped_at: new Date().toISOString(), elapsed_minutes: elapsed, grade: 'Met' };
        extraFields.dept_sla_log = log;
      }
      if (value === 'Resolved') extraFields.resolved_at = new Date().toISOString();
    }
    await db.Ticket.update(ticket.id, { [field]: value, ...extraFields });
    await db.TicketHistory.create({
      ticket_id: ticket.id,
      event_type: field === 'status' ? 'status_changed' : field === 'priority' ? 'priority_changed' : 'assigned',
      description,
      actor: user?.full_name || user?.email || 'Staff',
      old_value: oldValue,
      new_value: value,
    });
    if (onTicketUpdate) onTicketUpdate({ ...ticket, [field]: value, ...extraFields });
  };

  // SLA countdown
  const slaDeadline = ticket.sla_deadline ? new Date(ticket.sla_deadline) : null;
  const slaBreached = slaDeadline && now > slaDeadline;
  const slaMinutesLeft = slaDeadline ? differenceInMinutes(slaDeadline, now) : null;
  const slaLabel = slaBreached
    ? `Breached ${formatDistanceToNow(toPHTime(ticket.sla_deadline), { addSuffix: true })}`
    : slaMinutesLeft !== null
      ? slaMinutesLeft < 60
        ? `${slaMinutesLeft}m left`
        : `${Math.floor(slaMinutesLeft / 60)}h ${slaMinutesLeft % 60}m left`
      : null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-8 flex-shrink-0 bg-card border-l border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Show ticket info"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="w-64 flex-shrink-0 bg-card border-l border-border/50 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <span className="font-semibold text-sm">Ticket Info</span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 text-sm">
        {/* Customer */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Customer</p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              {ticket.customer_name?.[0] || 'C'}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate text-xs">{ticket.customer_name}</p>
              <p className="text-xs text-muted-foreground truncate">{ticket.customer_email}</p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Status</p>
          <Select value={ticket.status} onValueChange={v => handleChange('status', v, `Status changed to ${v}`, ticket.status)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Priority</p>
          <Select value={ticket.priority} onValueChange={v => handleChange('priority', v, `Priority changed to ${v}`, ticket.priority)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Assigned Agent */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Assigned To</p>
          <Select
            value={ticket.assigned_to || ''}
            onValueChange={v => handleChange('assigned_to', v, `Assigned to ${v}`, ticket.assigned_to)}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Unassigned</SelectItem>
              {agents.map(a => <SelectItem key={a.id} value={a.email}>{a.full_name || a.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* SLA */}
        {slaDeadline && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">SLA Deadline</p>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${slaBreached ? 'text-red-400' : slaMinutesLeft < 60 ? 'text-amber-400' : 'text-green-400'}`}>
              {slaBreached && <AlertTriangle className="w-3.5 h-3.5" />}
              <Clock className="w-3.5 h-3.5" />
              <span>{slaLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{formatPHTime(ticket.sla_deadline)}</p>
          </div>
        )}

        {/* Per-Department SLA Log */}
        {ticket.dept_sla_log?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dept SLA Timers</p>
            <div className="space-y-1.5">
              {ticket.dept_sla_log.map((entry, i) => {
                const isActive = entry.grade === 'Active';
                const elapsed = isActive
                  ? Math.round((now - new Date(entry.started_at).getTime()) / 60000)
                  : entry.elapsed_minutes || 0;
                const hrs = Math.floor(elapsed / 60);
                const mins = elapsed % 60;
                const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                return (
                  <div key={i} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs border ${
                    isActive ? 'bg-primary/5 border-primary/20' :
                    entry.grade === 'Breached' ? 'bg-red-500/5 border-red-500/20' :
                    'bg-green-500/5 border-green-500/20'
                  }`}>
                    <span className="font-medium truncate mr-1">{entry.department}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive && <Clock className="w-3 h-3 text-primary animate-pulse" />}
                      <span className={isActive ? 'text-primary font-semibold' : entry.grade === 'Breached' ? 'text-red-400' : 'text-green-400'}>
                        {timeStr}
                      </span>
                      <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                        isActive ? 'bg-primary/10 text-primary' :
                        entry.grade === 'Breached' ? 'bg-red-500/10 text-red-400' :
                        'bg-green-500/10 text-green-400'
                      }`}>{entry.grade}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Category & Department */}
        {ticket.category && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Category</p>
            <p className="text-xs">{ticket.category}</p>
          </div>
        )}
        {ticket.department && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Department</p>
            <p className="text-xs">{ticket.department}</p>
          </div>
        )}

        {/* Created */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Created</p>
          <p className="text-xs text-muted-foreground">{formatPHTime(ticket.created_date)}</p>
        </div>

        {/* History Log */}
        {history.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <History className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Changes</p>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {history.map(entry => (
                <div key={entry.id} className="text-xs border-l-2 border-muted-foreground/30 pl-2.5 py-0.5">
                  <p className="font-medium text-foreground">{entry.description}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{entry.actor} · {formatPHTime(entry.created_date)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Internal Staff Chat */}
        <div className="pt-2 border-t border-border/50 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Internal Staff Chat</p>
          </div>

          {/* Message history */}
          <div className="h-40 overflow-y-auto flex flex-col gap-2 bg-amber-500/5 rounded-lg p-2 border border-amber-500/20">
            {staffMessages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-4 italic">No internal notes yet</p>
            ) : staffMessages.map(msg => {
              const isMe = msg.sender_email === user?.email;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1">{msg.sender_name || msg.sender_email}</span>
                  <div className={`max-w-[90%] rounded-xl px-2.5 py-1.5 text-xs ${isMe ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 rounded-tr-sm' : 'bg-card border border-border/50 rounded-tl-sm'}`}>
                    {msg.message && <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>}
                    {msg.attachments?.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {msg.attachments.map((url, i) => {
                          const isImg = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
                          return isImg ? (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="attachment" className="max-w-full rounded-md mt-1 max-h-24 object-cover" />
                            </a>
                          ) : (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline opacity-70 hover:opacity-100">
                              <FileText className="w-3 h-3" /> File {i + 1}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{formatPHTime(msg.created_date)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {attachments.map((att, i) => (
                <div key={i} className="relative group">
                  {att.isImage ? (
                    <img src={att.url} alt={att.name} className="w-12 h-12 object-cover rounded-md border border-amber-500/30" />
                  ) : (
                    <div className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                      <FileText className="w-3 h-3 text-primary" />
                      <span className="text-xs max-w-[60px] truncate">{att.name}</span>
                    </div>
                  )}
                  <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="flex flex-col gap-1">
            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendNote(); } }}
              placeholder="Write a note… paste images too"
              rows={3}
              className="w-full text-xs rounded-lg border px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 bg-amber-500/5 border-amber-500/30 placeholder:text-amber-500/40 transition-colors"
            />
            <div className="flex items-center gap-1.5">
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="text-muted-foreground hover:text-amber-500 p-1 rounded transition-colors" title="Attach file">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv" className="hidden"
                onChange={e => handleFileUpload(e.target.files)} />
              <button
                onClick={handleSendNote}
                disabled={sendingNote || (!noteText.trim() && attachments.length === 0)}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sendingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Post Note
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}