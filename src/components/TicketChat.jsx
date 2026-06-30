import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Paperclip, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { formatDateFull } from '@/lib/timezone';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file

export default function TicketChat({ ticketId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!ticketId) return;
    loadMessages();
    const unsub = db.TicketMessage.subscribe(event => {
      if (event.data?.ticket_id === ticketId) {
        // Replace any optimistic messages with real ones on next load
        loadMessages();
      }
    });
    return () => unsub();
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const msgs = await db.TicketMessage.filter({ ticket_id: ticketId }, 'created_date');
    setMessages((msgs || []).filter(m => !m.is_internal));
  };

  const handleFileUpload = async (files) => {
    const remaining = 5 - attachments.length;
    const toUpload = Array.from(files).slice(0, remaining);
    const valid = toUpload.filter(f => {
      if (f.size > MAX_FILE_BYTES) { alert(`"${f.name}" is larger than 10 MB and was skipped.`); return false; }
      return true;
    });
    if (!valid.length) return;
    setUploading(true);
    try {
      for (const file of valid) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setAttachments(prev => [...prev, { name: file.name, url: file_url }]);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('A file failed to upload. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      ticket_id: ticketId,
      sender_email: user?.email || '',
      sender_name: user?.full_name || user?.email || 'Support',
      sender_role: 'staff',
      message: newMessage.trim(),
      attachments: attachments.map(a => a.url),
      created_date: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setAttachments([]);
    setSending(true);
    try {
      await db.TicketMessage.create({
        ticket_id: ticketId,
        sender_email: optimisticMsg.sender_email,
        sender_name: optimisticMsg.sender_name,
        sender_role: 'staff',
        message: optimisticMsg.message,
        attachments: optimisticMsg.attachments,
      });
      // Real messages arrive via subscription — it replaces the optimistic copy.
    } catch (err) {
      // Roll back the optimistic message and restore the draft so nothing is lost.
      console.error('Failed to send message:', err);
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setNewMessage(optimisticMsg.message);
      setAttachments(optimisticMsg.attachments.map((url, i) => ({ name: `Attachment ${i + 1}`, url })));
      alert('Failed to send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" style={{ maxHeight: '400px' }}>
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No messages yet. Start the conversation.</p>
        )}
        <AnimatePresence>
          {messages.map(msg => {
            const isStaff = msg.sender_role === 'staff';
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%]">
                  {!isStaff && (
                    <p className="text-muted-foreground text-xs mb-1 ml-1">{msg.sender_name || 'Customer'}</p>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 ${isStaff ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                    {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                    {msg.attachments?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.attachments.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100">
                            <FileText className="w-3 h-3" /> Attachment {i+1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs mt-1 text-right">
                    {formatDateFull(msg.created_date)}
                    {isStaff && ' · You'}
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
        <div className="px-4 pb-2 flex gap-2 flex-wrap border-t pt-2">
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
      <div className="p-4 border-t flex items-end gap-2">
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="text-muted-foreground hover:text-foreground p-1 shrink-0">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden"
          onChange={e => handleFileUpload(e.target.files)} />
        <Input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Reply to customer..."
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={sending || (!newMessage.trim() && attachments.length === 0)}
          size="icon" className="bg-primary hover:bg-primary/90 shrink-0">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}