import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Paperclip, X, FileText, Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const toPHTime = (dateStr) => new Date(new Date(dateStr).getTime() + 8 * 60 * 60 * 1000);
const formatPHTime = (dateStr) => {
  const d = toPHTime(dateStr);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${month} ${day}, ${hours}:${mins}`;
};

export default function InternalChat({ ticket }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const loadMessages = async () => {
    const msgs = await base44.entities.TicketMessage.filter(
      { ticket_id: ticket.id, is_internal: true },
      'created_date'
    );
    setMessages(msgs || []);
  };

  useEffect(() => {
    if (!ticket?.id) return;
    loadMessages();
    const unsub = base44.entities.TicketMessage.subscribe(event => {
      if (event.data?.ticket_id === ticket.id && event.data?.is_internal) {
        loadMessages();
      }
    });
    return () => unsub();
  }, [ticket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        e.preventDefault();
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

  const handleSend = async () => {
    if (!text.trim() && attachments.length === 0) return;
    setSending(true);
    await base44.entities.TicketMessage.create({
      ticket_id: ticket.id,
      sender_email: user?.email || '',
      sender_name: user?.full_name || user?.email || 'Staff',
      sender_role: 'staff',
      message: text.trim(),
      is_internal: true,
      attachments: attachments.map(a => a.url),
    });
    setText('');
    setAttachments([]);
    await loadMessages();
    setSending(false);
  };

  return (
    <div className="border-t border-border/50 flex flex-col" style={{ maxHeight: '320px' }}>
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/5 border-b border-amber-500/20">
        <Lock className="w-3 h-3 text-amber-500" />
        <span className="text-xs font-semibold text-amber-600">Internal Notes</span>
        <span className="text-xs text-muted-foreground ml-1">· staff only</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 bg-amber-500/[0.02]" style={{ minHeight: '80px' }}>
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 italic">No internal notes yet</p>
        ) : messages.map(msg => {
          const isMe = msg.sender_email === user?.email;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <p className="text-xs text-muted-foreground mb-0.5 px-1">{msg.sender_name || 'Staff'}</p>
              <div className={`max-w-[90%] rounded-xl px-3 py-1.5 text-xs
                ${isMe
                  ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 rounded-tr-none'
                  : 'bg-muted border border-border/50 rounded-tl-none'
                }`}>
                {msg.message && <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>}
                {msg.attachments?.map((url, i) => {
                  const isImg = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
                  return isImg
                    ? <img key={i} src={url} alt="attachment" className="mt-1.5 rounded max-w-full max-h-32 object-contain" />
                    : (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 mt-1 opacity-80 hover:opacity-100 underline">
                        <FileText className="w-3 h-3" /> Attachment {i + 1}
                      </a>
                    );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 px-1">{formatPHTime(msg.created_date)}</p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="px-3 py-1.5 flex gap-1.5 flex-wrap border-t border-border/30 bg-card">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1 bg-muted rounded px-2 py-1">
              {att.isImage
                ? <img src={att.url} alt="" className="w-5 h-5 rounded object-cover" />
                : <FileText className="w-3 h-3 text-primary" />}
              <span className="text-xs max-w-[70px] truncate">{att.name}</span>
              <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-1.5 px-3 py-2 bg-card border-t border-border/30">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors shrink-0"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden"
          onChange={e => handleFileUpload(e.target.files)} />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          placeholder="Add an internal note..."
          rows={1}
          className="flex-1 text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/40 placeholder:text-muted-foreground leading-relaxed"
          style={{ maxHeight: '72px', overflowY: 'auto' }}
        />
        <Button
          onClick={handleSend}
          disabled={sending || (!text.trim() && attachments.length === 0)}
          size="icon"
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-full w-7 h-7 shrink-0"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}