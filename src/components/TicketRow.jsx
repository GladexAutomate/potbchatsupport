import { User } from 'lucide-react';
import { formatDateRelative } from '@/lib/timezone';
import { formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

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

export default function TicketRow({ t, isVip, unread, selectedTicket, handleSelectTicket, ticketTags, allTags }) {
  const hasUnread = unread[t.id] > 0;
  const isClosed = t.status === 'Closed';
  const isSelected = selectedTicket?.id === t.id;
  const showBlue = isClosed;
  const showRed = hasUnread && !isClosed;

  return (
    <button
      key={t.id}
      onClick={() => handleSelectTicket(t)}
      className={`w-full text-left px-4 py-3.5 border-b transition-colors relative select-none min-h-[56px]
        ${isVip ? 'border-yellow-500/20' : 'border-border/30'}
        ${isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/40'}
        ${isVip && !isSelected ? 'bg-yellow-500/5 hover:bg-yellow-500/10' : ''}
        ${showRed && !isSelected && !isVip ? 'bg-red-500/5' : ''}
        ${showBlue && !isSelected ? 'bg-blue-500/5' : ''}
      `}
    >
      {/* Priority indicator dots */}
      {showRed && !isSelected && (
        <span className="absolute top-3.5 right-3 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_2px_rgba(239,68,68,0.5)]" />
      )}
      {showBlue && !isSelected && (
        <span className="absolute top-3.5 right-3 w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_6px_2px_rgba(96,165,250,0.5)]" />
      )}
      {isVip && !showRed && !showBlue && !isSelected && (
        <span className="absolute top-3.5 right-3 text-sm">⭐</span>
      )}
      <div className="flex items-start gap-2.5 pr-5">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
          ${isVip ? 'bg-yellow-500/20 text-yellow-600' : showRed ? 'bg-red-100 text-red-500' : showBlue ? 'bg-blue-100 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
          {isVip ? '👑' : <User className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[t.priority] || ''}`}>{t.priority}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[t.status] || ''}`}>{t.status}</span>
            {isVip && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 font-bold border border-yellow-500/30">VIP</span>
            )}
            {showRed && (
              <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-bounce">
                {unread[t.id]}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-sm truncate max-w-[160px] ${showRed || showBlue || isVip ? 'font-bold text-foreground' : 'font-medium'}`}>
              {t.customer_name}
            </span>
            <span className="text-xs text-muted-foreground ml-1 flex-shrink-0">
              {formatDateRelative(t.updated_date || t.created_date)}
            </span>
          </div>
          <p className={`text-xs truncate ${showRed || isVip ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            {t.subject}
          </p>
          {(() => {
            const displayTags = ticketTags[t.id] !== undefined ? ticketTags[t.id] : (t.tags || []);
            return displayTags.length > 0 ? (
              <div className="flex gap-1 flex-wrap mt-1">
                {displayTags.map(tagName => {
                  const tagObj = allTags.find(tg => tg.name === tagName);
                  return (
                    <span
                      key={tagName}
                      className="text-xs px-1.5 py-0.5 rounded font-semibold text-white"
                      style={{ background: tagObj?.color || '#6366f1' }}
                    >
                      {tagName}
                    </span>
                  );
                })}
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </button>
  );
}