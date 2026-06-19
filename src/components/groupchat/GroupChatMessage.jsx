import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { Pin, Reply, ExternalLink, FileText, SmilePlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const EMOJIS = ['👍', '✅', '🔥', '❤️', '😂', '🙏'];

const toPHTime = (d) => new Date(new Date(d).getTime() + 8 * 60 * 60 * 1000);

const PRIORITY_COLOR = {
  Low: 'bg-slate-500/10 text-slate-400',
  Medium: 'bg-blue-500/10 text-blue-400',
  High: 'bg-amber-500/10 text-amber-400',
  Critical: 'bg-red-500/10 text-red-500',
};
const STATUS_COLOR = {
  Open: 'bg-blue-500/10 text-blue-400',
  'In Progress': 'bg-amber-500/10 text-amber-400',
  'Pending Department': 'bg-purple-500/10 text-purple-400',
  'Pending Resolution': 'bg-orange-500/10 text-orange-400',
  Resolved: 'bg-green-500/10 text-green-400',
  Closed: 'bg-slate-500/10 text-slate-400',
};

export default function GroupChatMessageBubble({ msg, currentUser, isMe, onReply, onPinToggle, allMessages }) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [staffMap, setStaffMap] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    db.User.list().then(staff => {
      const map = {};
      (staff || []).forEach(s => {
        map[s.email?.toLowerCase()] = s.full_name;
      });
      setStaffMap(map);
    });
  }, []);

  const repliedMsg = msg.reply_to_id ? allMessages.find(m => m.id === msg.reply_to_id) : null;

  const handleReact = async (emoji) => {
    const reactions = { ...(msg.reactions || {}) };
    const users = reactions[emoji] ? [...reactions[emoji]] : [];
    const idx = users.indexOf(currentUser.email);
    if (idx >= 0) users.splice(idx, 1);
    else users.push(currentUser.email);
    if (users.length === 0) delete reactions[emoji];
    else reactions[emoji] = users;
    await base44.entities.GroupChatMessage.update(msg.id, { reactions });
    setShowEmojiPicker(false);
  };

  const isImage = (url) => /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);

  const renderMentions = (text) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) =>
      /^@\w+/.test(part)
        ? <span key={i} className="text-primary font-semibold">{part}</span>
        : part
    );
  };

  return (
    <div
      className={`group flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end mb-1`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      {/* Avatar */}
      {!isMe && (
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mb-4">
          {msg.sender_name?.[0] || 'S'}
        </div>
      )}

      <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Sender name + time */}
        {!isMe && (
          <span className="text-xs text-muted-foreground mb-1 px-1 font-medium">{msg.sender_name}</span>
        )}

        {/* Reply preview */}
        {repliedMsg && (
          <div className={`mb-1 px-3 py-1.5 rounded-lg border-l-2 border-primary bg-muted/40 text-xs max-w-full ${isMe ? 'items-end' : ''}`}>
            <p className="font-semibold text-primary text-[11px]">{repliedMsg.sender_name}</p>
            <p className="text-muted-foreground truncate">{repliedMsg.message || '📎 Attachment'}</p>
          </div>
        )}

        {/* Pin indicator */}
        {msg.is_pinned && (
          <div className="flex items-center gap-1 text-[10px] text-amber-500 mb-0.5 px-1">
            <Pin className="w-2.5 h-2.5" /> Pinned
          </div>
        )}

        {/* Ticket endorsement card */}
        {msg.message_type === 'ticket_endorsement' && msg.ticket_ref && (
          <div className="bg-card border border-primary/30 rounded-xl p-3 shadow-sm w-72 mb-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary">{msg.ticket_ref.ticket_number}</p>
                <p className="text-[11px] text-muted-foreground">Ticket Endorsement</p>
              </div>
            </div>
            <p className="text-sm font-medium mb-2 leading-snug">{msg.ticket_ref.subject}</p>
            <div className="flex flex-wrap gap-1 mb-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[msg.ticket_ref.priority] || 'bg-muted text-muted-foreground'}`}>
                {msg.ticket_ref.priority}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLOR[msg.ticket_ref.status] || 'bg-muted text-muted-foreground'}`}>
                {msg.ticket_ref.status}
              </span>
              {msg.ticket_ref.department && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
                  {msg.ticket_ref.department}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">Customer: {msg.ticket_ref.customer_name}</p>
            {msg.message && (
              <p className="text-xs italic text-muted-foreground border-t border-border/50 pt-2 mt-1">"{msg.message}"</p>
            )}
            <button
              onClick={() => {
                let route = '/tickets';
                if (msg.ticket_ref.is_vip) {
                  route = '/vip-tickets';
                } else if (msg.ticket_ref.escalated) {
                  route = '/escalations';
                }
                navigate(`${route}?open=${msg.ticket_ref.ticket_id}`, { replace: true });
              }}
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              <ExternalLink className="w-3 h-3" /> Open Ticket
            </button>
          </div>
        )}

        {/* Regular message bubble */}
        {msg.message_type !== 'ticket_endorsement' && (
          <div className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm whitespace-pre-wrap leading-relaxed
            ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border/50 rounded-bl-sm'}`}>
            {msg.message && <p>{renderMentions(msg.message)}</p>}
            {msg.attachments?.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {msg.attachments.map((url, i) =>
                  isImage(url) ? (
                    <img key={i} src={url} alt="attachment" className="max-w-[220px] max-h-[180px] rounded-lg object-cover cursor-pointer hover:opacity-90" onClick={() => window.open(url, '_blank')} />
                  ) : (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs opacity-80 hover:opacity-100 underline">
                      <FileText className="w-3 h-3" /> File {i + 1}
                    </a>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Timestamp + read receipts */}
        <div className={`flex items-center gap-2 mt-0.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(toPHTime(msg.created_date), { addSuffix: true })}
          </span>
          {isMe && msg.read_by?.length > 1 && (
            <span className="text-[10px] text-muted-foreground">
              Seen by {msg.read_by.length - 1}
            </span>
          )}
        </div>

        {/* Reactions */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className={`flex gap-1 flex-wrap mt-1 ${isMe ? 'justify-end' : ''}`}>
            {Object.entries(msg.reactions).map(([emoji, users]) =>
              users.length > 0 ? (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  title={users.map(email => staffMap[email.toLowerCase()] || email).join(', ')}
                  className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors
                    ${users.includes(currentUser.email) ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border/50 hover:bg-muted/80'}`}
                >
                  {emoji} {users.length}
                </button>
              ) : null
            )}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {showActions && (
        <div className={`flex items-center gap-0.5 self-center relative ${isMe ? 'mr-1 flex-row-reverse' : 'ml-1'}`}>
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(v => !v)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="React"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
            {showEmojiPicker && (
              <div className={`absolute bottom-7 ${isMe ? 'right-0' : 'left-0'} bg-card border border-border rounded-xl shadow-xl p-2 flex gap-1.5 z-50`}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => handleReact(e)} className="text-lg hover:scale-125 transition-transform">{e}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onReply(msg)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Reply">
            <Reply className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onPinToggle(msg)} className={`p-1 rounded-lg hover:bg-muted transition-colors ${msg.is_pinned ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'}`} title={msg.is_pinned ? 'Unpin' : 'Pin'}>
            <Pin className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}