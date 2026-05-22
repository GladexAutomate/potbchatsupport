import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShieldCheck, ArrowLeft, Send, Loader2, ChevronRight, Paperclip, X, FileText, ThumbsUp, ThumbsDown } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ImageLightbox from '@/components/ImageLightbox';
import RatingModal from '@/components/RatingModal';

const STATUS_COLOR = {
  'Open': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'In Progress': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Pending Department': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Resolved': 'bg-green-500/20 text-green-300 border-green-500/30',
  'Closed': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export default function MyTickets() {
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [msgAttachments, setMsgAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingTicket, setRatingTicket] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.email) {
        base44.entities.Ticket.filter({ customer_email: u.email }, '-created_date').then(t => {
          setTickets(t || []);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTicket) return;
    loadMessages(selectedTicket.id);
    // Subscribe to ticket changes (e.g. auto-close triggers rating modal)
    const unsubTicket = base44.entities.Ticket.subscribe(event => {
      if (event.data?.id === selectedTicket.id && event.data?.status === 'Closed') {
        setSelectedTicket(event.data);
        setTickets(prev => prev.map(t => t.id === event.data.id ? event.data : t));
        // Show rating modal if not yet rated
        setRatingTicket(event.data);
        setShowRatingModal(true);
      }
    });
    const unsubMsg = base44.entities.TicketMessage.subscribe(event => {
      if (event.data?.ticket_id === selectedTicket.id) {
        loadMessages(selectedTicket.id);
      }
    });
    return () => { unsubTicket(); unsubMsg(); };
  }, [selectedTicket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (ticketId) => {
    const msgs = await base44.entities.TicketMessage.filter({ ticket_id: ticketId }, 'created_date');
    setMessages((msgs || []).filter(m => !m.is_internal));
  };

  const handleFileUpload = async (files) => {
    const remaining = 5 - msgAttachments.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (!toUpload.length) return;
    setUploading(true);
    for (const file of toUpload) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setMsgAttachments(prev => [...prev, { name: file.name, url: file_url }]);
    }
    setUploading(false);
  };

  const handleSend = async () => {
    if (!newMessage.trim() && msgAttachments.length === 0) return;
    setSending(true);
    await base44.entities.TicketMessage.create({
      ticket_id: selectedTicket.id,
      sender_email: user.email,
      sender_name: user.full_name || user.email,
      sender_role: 'customer',
      message: newMessage.trim(),
      attachments: msgAttachments.map(a => a.url),
    });
    setNewMessage('');
    setMsgAttachments([]);
    await loadMessages(selectedTicket.id);
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
          setMsgAttachments(prev => [...prev, { name: 'pasted-image.png', url: file_url }]);
          setUploading(false);
        }
      }
    }
  };

  const isImageUrl = (url) => /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);

  const handleResolutionResponse = async (resolved) => {
    if (resolved) {
      // Close ticket and show rating
      const log = [...(selectedTicket.dept_sla_log || [])];
      const activeIdx = log.findIndex(e => e.grade === 'Active');
      if (activeIdx !== -1) {
        const active = log[activeIdx];
        const elapsed = Math.round((Date.now() - new Date(active.started_at).getTime()) / 60000);
        log[activeIdx] = { ...active, stopped_at: new Date().toISOString(), elapsed_minutes: elapsed, grade: 'Met' };
      }
      const updatedTicket = { ...selectedTicket, status: 'Closed', resolved_at: new Date().toISOString(), dept_sla_log: log };
      await base44.entities.Ticket.update(selectedTicket.id, { status: 'Closed', resolved_at: new Date().toISOString(), dept_sla_log: log });
      await base44.entities.TicketMessage.create({
        ticket_id: selectedTicket.id,
        sender_email: user.email,
        sender_name: user.full_name || user.email,
        sender_role: 'customer',
        message: '✅ Yes, my concern has been resolved. Thank you!',
        attachments: [],
      });
      setSelectedTicket(updatedTicket);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
      setRatingTicket(updatedTicket);
      setShowRatingModal(true);
    } else {
      // Reopen ticket
      await base44.entities.Ticket.update(selectedTicket.id, { status: 'In Progress', resolution_requested_at: null });
      await base44.entities.TicketMessage.create({
        ticket_id: selectedTicket.id,
        sender_email: user.email,
        sender_name: user.full_name || user.email,
        sender_role: 'customer',
        message: '❌ No, my concern has not been resolved yet. I still need assistance.',
        attachments: [],
      });
      setSelectedTicket(prev => ({ ...prev, status: 'In Progress', resolution_requested_at: null }));
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'In Progress' } : t));
    }
  };

  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col items-center justify-center text-center px-4">
        <ShieldCheck className="w-12 h-12 text-primary mb-4" />
        <h2 className="font-sora text-2xl font-bold text-white mb-2">Sign in to view your tickets</h2>
        <p className="text-white/50 mb-6">Please log in to see your support tickets.</p>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => base44.auth.redirectToLogin('/my-tickets')}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <>
    {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    {showRatingModal && ratingTicket && (
      <RatingModal ticket={ratingTicket} onClose={() => setShowRatingModal(false)} />
    )}
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <span className="font-sora font-bold text-white text-lg">LakbayHub</span>
        <span className="text-white/40 text-sm">Support</span>
        <div className="ml-auto">
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white gap-1">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Ticket List */}
        <div className={`${selectedTicket ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-white/10 overflow-y-auto`}>
          <div className="px-4 py-4 border-b border-white/10">
            <h2 className="font-sora font-semibold text-white">My Tickets</h2>
            <p className="text-white/40 text-xs mt-0.5">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center flex-1 py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-12 text-center px-4">
              <p className="text-white/40 text-sm">No tickets yet.</p>
            </div>
          ) : (
            tickets.map(ticket => (
              <button key={ticket.id} onClick={() => setSelectedTicket(ticket)}
                className={`w-full text-left px-4 py-4 border-b border-white/5 hover:bg-white/5 transition-all ${selectedTicket?.id === ticket.id ? 'bg-white/10' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs text-white/40">{ticket.ticket_number}</span>
                  <Badge className={`text-xs border shrink-0 ${STATUS_COLOR[ticket.status]}`}>{ticket.status}</Badge>
                </div>
                <p className="text-white text-sm font-medium line-clamp-1">{ticket.subject}</p>
                <p className="text-white/40 text-xs mt-1">{formatDistanceToNow(new Date(ticket.created_date), { addSuffix: true })}</p>
                <ChevronRight className="w-4 h-4 text-white/20 ml-auto -mt-4" />
              </button>
            ))
          )}
        </div>

        {/* Chat Panel */}
        <div className={`${selectedTicket ? 'flex' : 'hidden md:flex'} flex-col flex-1 overflow-hidden`}>
          {!selectedTicket ? (
            <div className="flex items-center justify-center flex-1 text-center px-4">
              <div>
                <p className="text-white/30 text-sm">Select a ticket to view the conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3">
                <button onClick={() => setSelectedTicket(null)} className="md:hidden text-white/60 hover:text-white">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-white/40">{selectedTicket.ticket_number}</span>
                    <Badge className={`text-xs border ${STATUS_COLOR[selectedTicket.status]}`}>{selectedTicket.status}</Badge>
                    {selectedTicket.category && (
                      <Badge className="text-xs border bg-white/10 text-white/60 border-white/10">{selectedTicket.category}</Badge>
                    )}
                  </div>
                  <p className="text-white font-medium text-sm truncate mt-0.5">{selectedTicket.subject}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {/* Original ticket description as first message */}
                <div className="flex justify-end">
                  <div className="max-w-[80%]">
                    <div className="bg-primary rounded-2xl rounded-br-sm px-4 py-3">
                      <p className="text-white text-sm font-medium mb-1">{selectedTicket.subject}</p>
                      <p className="text-white/80 text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                      {selectedTicket.attachments?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {selectedTicket.attachments.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs">
                              <FileText className="w-3 h-3" /> Attachment {i+1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-white/30 text-xs mt-1 text-right">
                      {format(new Date(selectedTicket.created_date), 'MMM d, HH:mm')} · You
                    </p>
                  </div>
                </div>

                {/* Chat messages */}
                <AnimatePresence>
                  {messages.map((msg, idx) => {
                    const isMe = msg.sender_role === 'customer';
                    const isResolutionRequest = msg.message_type === 'resolution_request';
                    const isLastResolutionRequest = isResolutionRequest &&
                      idx === messages.map(m => m.message_type).lastIndexOf('resolution_request') &&
                      selectedTicket.status === 'Pending Resolution';

                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[80%]">
                          {!isMe && (
                            <p className="text-white/40 text-xs mb-1 ml-1">Support Team</p>
                          )}
                          <div className={`rounded-2xl px-4 py-3 ${
                            isResolutionRequest
                              ? 'bg-green-500/20 border border-green-500/40 rounded-bl-sm'
                              : isMe ? 'bg-primary rounded-br-sm' : 'bg-white/10 rounded-bl-sm'
                          }`}>
                            {msg.message && <p className={`text-sm whitespace-pre-wrap ${isMe ? 'text-white' : 'text-white/90'}`}>{msg.message}</p>}
                            {msg.attachments?.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {msg.attachments.map((url, i) => (
                                  isImageUrl(url) ? (
                                    <img key={i} src={url} alt={`attachment-${i+1}`}
                                      onClick={() => setLightboxUrl(url)}
                                      className="max-w-[200px] max-h-[160px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                                  ) : (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs">
                                      <FileText className="w-3 h-3" /> Attachment {i+1}
                                    </a>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                          {/* YES / NO buttons for resolution request */}
                          {isLastResolutionRequest && (
                            <div className="flex gap-2 mt-2 ml-1">
                              <button
                                onClick={() => handleResolutionResponse(true)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
                              >
                                <ThumbsUp className="w-4 h-4" /> Yes, Resolved!
                              </button>
                              <button
                                onClick={() => handleResolutionResponse(false)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-white/80 text-sm font-medium hover:bg-white/20 transition-colors"
                              >
                                <ThumbsDown className="w-4 h-4" /> No, Still Need Help
                              </button>
                            </div>
                          )}
                          <p className="text-white/30 text-xs mt-1 text-right">
                            {format(new Date(msg.created_date), 'MMM d, HH:mm')}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Attachment preview */}
              {msgAttachments.length > 0 && (
                <div className="px-4 pb-2 flex gap-2 flex-wrap">
                  {msgAttachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
                      <FileText className="w-3 h-3 text-primary" />
                      <span className="text-white/70 text-xs max-w-[120px] truncate">{att.name}</span>
                      <button onClick={() => setMsgAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-3 h-3 text-white/40 hover:text-white/70" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input */}
              {selectedTicket.status !== 'Closed' && selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'Pending Resolution' ? (
                <div className="px-4 pb-4 pt-2 border-t border-white/10 flex items-end gap-2">
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="text-white/40 hover:text-white/70 p-2 shrink-0">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <input ref={fileInputRef} type="file" multiple className="hidden"
                    onChange={e => handleFileUpload(e.target.files)} />
                  <Input
                   value={newMessage}
                   onChange={e => setNewMessage(e.target.value)}
                   onKeyDown={handleKeyDown}
                   onPaste={handlePaste}
                   placeholder="Type a message..."
                   className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/30"
                  />
                  <Button onClick={handleSend} disabled={sending || (!newMessage.trim() && msgAttachments.length === 0)}
                    size="icon" className="bg-primary hover:bg-primary/90 shrink-0">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              ) : selectedTicket.status === 'Pending Resolution' ? (
                <div className="px-4 pb-4 pt-2 border-t border-white/10 text-center">
                  <p className="text-white/50 text-sm">👆 Please respond above — is your concern resolved?</p>
                </div>
              ) : (
                <div className="px-4 pb-4 pt-2 border-t border-white/10 text-center">
                  <p className="text-white/30 text-sm">This ticket is {selectedTicket.status.toLowerCase()}.</p>
                  {(selectedTicket.status === 'Closed') && (
                    <button
                      onClick={() => { setRatingTicket(selectedTicket); setShowRatingModal(true); }}
                      className="mt-2 text-xs text-yellow-400 underline hover:text-yellow-300"
                    >
                      Rate your experience ⭐
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}