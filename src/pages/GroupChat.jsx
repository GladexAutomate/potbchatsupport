import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Paperclip, X, FileText, Pin, Search, Users, MessageSquare } from 'lucide-react';
import GroupChatMessageBubble from '@/components/groupchat/GroupChatMessage';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateRelative } from '@/lib/timezone';
import { toZonedTime } from 'date-fns-tz';
import { useGlobalMentionContext } from '@/lib/MentionContext';

export default function GroupChat() {
  const { user } = useAuth();
  const { setMentionNotification, mentionTimerRef } = useGlobalMentionContext();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPinned, setShowPinned] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const isImageUrl = (url) => /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);

  useEffect(() => {
    let loadTimer;
    
    // Initial load of messages only
    const initialLoad = async () => {
      const msgs = await db.GroupChatMessage.list('created_date', 200);
      setMessages(msgs || []);
    };

    initialLoad();
    db.User.list().then(d => setAllStaff(d || []));
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Real-time subscription - append new messages and check mentions
    const unsub = db.GroupChatMessage.subscribe((event) => {
      if (event.type !== 'create') return;
      
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => {
        setMessages(prev => {
          const msgIds = new Set(prev.map(m => m.id));
          if (event.data && !msgIds.has(event.data.id)) {
            const newMessages = [...prev, event.data].sort((a, b) => 
              new Date(a.created_date) - new Date(b.created_date)
            );
            
            // Check for mentions
            if (user?.full_name && event.data.sender_email !== user?.email && event.data.mentions?.length > 0) {
              const isMentioned = event.data.mentions.some(m => 
                m.toLowerCase().includes(user.full_name.toLowerCase()) || 
                m.toLowerCase().includes(user.email.toLowerCase())
              );
              
              if (isMentioned && !localStorage.getItem(`mentioned_${event.data.id}`)) {
                localStorage.setItem(`mentioned_${event.data.id}`, 'true');
                
                setMentionNotification({
                  sender: event.data.sender_name,
                  message: event.data.message?.slice(0, 100) || '📎 Sent an attachment',
                  timestamp: Date.now(),
                });
                
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(`🔔 ${event.data.sender_name} mentioned you in Group Chat`, {
                    body: event.data.message?.slice(0, 100) || '📎 Sent an attachment',
                    icon: '/favicon.ico',
                    tag: 'group-chat-mention',
                    requireInteraction: true,
                  });
                }
                
                try {
                  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBg==');
                  audio.play().catch(() => {});
                } catch (e) {}
                
                clearInterval(mentionTimerRef.current);
                mentionTimerRef.current = setInterval(() => {
                  setMentionNotification({
                    sender: event.data.sender_name,
                    message: event.data.message?.slice(0, 100) || '📎 Sent an attachment',
                    timestamp: Date.now(),
                  });
                }, 5000);
              }
            }
            
            return newMessages;
          }
          return prev;
        });
      }, 500);
    });
    
    return () => { clearTimeout(loadTimer); unsub(); };
  }, [user?.full_name, user?.email, setMentionNotification, mentionTimerRef]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read with longer debounce to prevent rate limit
  useEffect(() => {
    if (!user || messages.length === 0) return;
    
    const readTimer = setTimeout(() => {
      const unreadMessages = messages.filter(msg => !msg.read_by?.includes(user.email));
      if (unreadMessages.length > 0) {
        Promise.all(unreadMessages.map(msg => 
          db.GroupChatMessage.update(msg.id, { 
            read_by: [...(msg.read_by || []), user.email] 
          })
        )).catch(() => {});
      }
    }, 5000);

    return () => clearTimeout(readTimer);
  }, [messages, user]);

  const loadMessages = async () => {
    const msgs = await db.GroupChatMessage.list('created_date', 200);
    setMessages(msgs || []);
  };

  const handleSend = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    setSending(true);

    // Extract full mentions from message and match with staff directory
    const mentionMatches = [...newMessage.matchAll(/@([\w]+(?:\s+[\w]+)*)/g)];
    const mentions = mentionMatches.map(m => {
      const mentionedName = m[1];
      const matchedStaff = allStaff.find(s => s.full_name === mentionedName);
      return matchedStaff ? matchedStaff.full_name : mentionedName;
    });
    const uniqueMentions = [...new Set(mentions)];

    await db.GroupChatMessage.create({
      sender_email: user?.email || '',
      sender_name: user?.full_name || user?.email || 'Staff',
      message: newMessage.trim(),
      message_type: attachments.length > 0 ? 'image' : 'text',
      attachments: attachments.map(a => a.url),
      reply_to_id: replyTo?.id || null,
      reply_to_preview: replyTo?.message?.slice(0, 80) || null,
      reply_to_sender: replyTo?.sender_name || null,
      reactions: {},
      read_by: [user?.email || ''],
      mentions: uniqueMentions,
    });

    setNewMessage('');
    setAttachments([]);
    setReplyTo(null);
    setSending(false);
  };

  const handleFileUpload = async (files) => {
    const toUpload = Array.from(files).slice(0, 5 - attachments.length);
    if (!toUpload.length) return;
    setUploading(true);
    for (const file of toUpload) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAttachments(prev => [...prev, { name: file.name, url: file_url }]);
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
          setAttachments(prev => [...prev, { name: 'pasted-image.png', url: file_url }]);
          setUploading(false);
        }
      }
    }
  };

  const handlePinToggle = async (msg) => {
    await db.GroupChatMessage.update(msg.id, { is_pinned: !msg.is_pinned });
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);
    // Mention detection - match @ followed by name until space or end
    const match = val.match(/@([\w\s]*)$/);
    if (match) {
      const q = match[1].toLowerCase().trim();
      setMentionQuery(q);
      if (allStaff.length > 0) {
        setMentionSuggestions(allStaff.filter(s =>
          s.full_name && (s.full_name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)) && s.email !== user?.email
        ).slice(0, 5));
      }
    } else {
      setMentionSuggestions([]);
    }
  };

  const insertMention = (staff) => {
    // Replace the @ mention with the staff name (keep spaces, just use the name as-is)
    const displayName = staff.full_name || staff.email;
    const replaced = newMessage.replace(/@[\w]*$/, `@${displayName} `);
    setNewMessage(replaced);
    setMentionSuggestions([]);
    inputRef.current?.focus();
  };

  const pinnedMessages = messages.filter(m => m.is_pinned);
  const filteredMessages = searchQuery
    ? messages.filter(m =>
        m.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.ticket_ref?.ticket_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;
  const displayMessages = showPinned ? pinnedMessages : filteredMessages;

  const unreadCount = messages.filter(m => !m.read_by?.includes(user?.email)).length;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] relative">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border/50 bg-card flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-poppins font-bold text-sm">Staff Group Chat</h2>
          <p className="text-xs text-muted-foreground">{allStaff.length} staff members • All departments</p>
        </div>
        <div className="flex items-center gap-2">
          {pinnedMessages.length > 0 && (
            <button
              onClick={() => setShowPinned(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showPinned ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              <Pin className="w-3.5 h-3.5" />
              {pinnedMessages.length} pinned
            </button>
          )}
          <button
            onClick={() => { setShowSearch(v => !v); setSearchQuery(''); }}
            className={`p-2 rounded-lg border transition-colors ${showSearch ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 border-b border-border/50 bg-muted/30 flex-shrink-0 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages, tickets, names..."
                className="pl-9 h-8 text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-1.5">{filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''} found</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned banner */}
      {showPinned && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-600 font-medium flex-shrink-0">
          📌 Showing {pinnedMessages.length} pinned message{pinnedMessages.length !== 1 ? 's' : ''}
          <button onClick={() => setShowPinned(false)} className="ml-2 underline">Show all</button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-muted/5">
        {displayMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium">{showPinned ? 'No pinned messages' : 'No messages yet'}</p>
            <p className="text-sm opacity-70 mt-1">{showPinned ? '' : 'Start the conversation!'}</p>
          </div>
        )}
        <AnimatePresence>
          {displayMessages.map((msg, idx) => {
            const isMe = msg.sender_email === user?.email;
            const prevMsg = displayMessages[idx - 1];
            const showDateSep = !prevMsg || new Date(msg.created_date).toDateString() !== new Date(prevMsg.created_date).toDateString();
            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-xs text-muted-foreground px-2 bg-background rounded-full border border-border/50 py-0.5">
                      {toZonedTime(new Date(msg.created_date), 'Asia/Manila').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                )}
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <GroupChatMessageBubble
                    msg={msg}
                    currentUser={user}
                    isMe={isMe}
                    onReply={setReplyTo}
                    onPinToggle={handlePinToggle}
                    allMessages={messages}
                  />
                </motion.div>
              </div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 border-t border-primary/20 bg-primary/5 flex items-center gap-2 flex-shrink-0 overflow-hidden">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary">{replyTo.sender_name}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.message || '📎 Attachment'}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-border/50 bg-card flex gap-2 flex-wrap flex-shrink-0">
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

      {/* Mention suggestions */}
      {mentionSuggestions.length > 0 && (
        <div className="mx-4 mb-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden flex-shrink-0">
          {mentionSuggestions.map(s => (
            <button key={s.id} onClick={() => insertMention(s)}
              className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                {s.full_name?.[0] || 'S'}
              </div>
              <span className="font-medium">{s.full_name}</span>
              <span className="text-muted-foreground text-xs">{s.role}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-4 pt-2 flex items-end gap-2 bg-card border-t border-border/50 flex-shrink-0">
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="text-muted-foreground hover:text-foreground p-1.5 shrink-0 rounded-lg hover:bg-muted transition-colors">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden"
          onChange={e => handleFileUpload(e.target.files)} />
        <Input
          ref={inputRef}
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          onPaste={handlePaste}
          placeholder="Type a message… use @ to mention someone"
          className="flex-1 rounded-full border-0 focus-visible:ring-1 bg-muted"
        />
        <Button onClick={handleSend}
          disabled={sending || (!newMessage.trim() && attachments.length === 0)}
          size="icon" className="bg-primary hover:bg-primary/90 rounded-full shrink-0">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}