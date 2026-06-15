import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';

export default function EscalationTimeline({ ticket }) {
  if (!ticket.escalated) return null;

  const escalatedAt = ticket.updated_date;
  const createdAt = ticket.created_date;
  const timeUntilEscalation = new Date(escalatedAt) - new Date(createdAt);
  const hoursUntilEscalation = Math.floor(timeUntilEscalation / (1000 * 60 * 60));
  const minutesUntilEscalation = Math.floor((timeUntilEscalation % (1000 * 60 * 60)) / (1000 * 60));

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-blue-500" />
        <p className="font-semibold text-sm">Escalation Timeline</p>
      </div>

      <div className="space-y-4 ml-6">
        {/* Created */}
        <div className="flex gap-3 relative">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-gray-400 mt-2"></div>
            <div className="w-0.5 h-12 bg-gray-300"></div>
          </div>
          <div className="pb-4">
            <p className="text-xs font-medium text-muted-foreground">Created</p>
            <p className="text-sm">{formatDate(createdAt)}</p>
          </div>
        </div>

        {/* Escalated */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          </div>
          <div>
            <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Escalated</p>
            <p className="text-sm font-medium">{formatDate(escalatedAt)}</p>
            {hoursUntilEscalation > 0 || minutesUntilEscalation > 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                After {hoursUntilEscalation > 0 ? `${hoursUntilEscalation}h ${minutesUntilEscalation}m` : `${minutesUntilEscalation}m`}
              </p>
            ) : null}
            {ticket.escalation_reason && (
              <div className="mt-2 bg-orange-500/10 border border-orange-500/20 rounded p-2">
                <div className="flex gap-2 text-xs">
                  <AlertCircle className="w-3 h-3 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <p className="text-orange-600 dark:text-orange-400">{ticket.escalation_reason}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Escalated By */}
        {ticket.escalation_reason && (
          <div className="flex gap-3 pt-2 border-t border-blue-500/10">
            <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 flex-shrink-0"></div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Escalated By</p>
              <p className="text-sm">{ticket.created_by_name || ticket.created_by_email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}