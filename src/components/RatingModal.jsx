import { useState } from 'react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Star, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RatingModal({ ticket, onClose, onRated }) {
   const [rating, setRating] = useState(0);
   const [hovered, setHovered] = useState(0);
   const [remarks, setRemarks] = useState('');
   const [submitting, setSubmitting] = useState(false);
   const [done, setDone] = useState(false);

   // Attribution: the ASSIGNED agent takes precedence; if the ticket was never
   // assigned, credit the staffer who requested resolution.
   const ratedEmail = ticket.assigned_to || ticket.resolution_requested_by || '';
   const staffName = ticket.assigned_to
     ? (ticket.assigned_to_name || ticket.assigned_to)
     : (ticket.resolution_requested_by_name || ticket.resolution_requested_by || 'Support Team');

   const handleSubmit = async () => {
     if (!rating) return;
     setSubmitting(true);
     try {
       // Check if rating already exists for this ticket (safeguard)
       const existing = await db.StaffRating.filter({ ticket_id: ticket.id }, '', 1);
       if (existing.length > 0) {
         setSubmitting(false);
         onClose();
         return;
       }
       await db.StaffRating.create({
         ticket_id: ticket.id,
         staff_email: ratedEmail,
         staff_name: staffName,
         rating,
         remarks: remarks.trim(),
         rated_at: new Date().toISOString(),
       });
       // If the ticket had no assignee, assign it to whoever resolved it (so the
       // ticket reflects who actually handled it) — and close it if pending.
       const ticketUpdates = {};
       if (!ticket.assigned_to && ticket.resolution_requested_by) {
         ticketUpdates.assigned_to = ticket.resolution_requested_by;
       }
       if (ticket._pendingSLALog) {
         ticketUpdates.status = 'Closed';
         ticketUpdates.resolved_at = new Date().toISOString();
         ticketUpdates.dept_sla_log = ticket._pendingSLALog;
       }
       if (Object.keys(ticketUpdates).length > 0) {
         await db.Ticket.update(ticket.id, ticketUpdates);
       }
       setDone(true);
       setSubmitting(false);
       if (onRated) onRated(ticket.id);
       setTimeout(() => onClose(), 2000);
     } catch (error) {
       setSubmitting(false);
       console.error('Rating submission error:', error);
     }
   };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-border/50"
      >
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <Star className="w-7 h-7 text-green-500 fill-green-500" />
              </div>
              <p className="font-poppins font-bold text-lg">Thank you!</p>
              <p className="text-muted-foreground text-sm mt-1">Your feedback has been submitted.</p>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="text-center">
                <p className="font-poppins font-bold text-base">Rate your support experience</p>
                <p className="text-muted-foreground text-sm mt-1">
                  How was your experience with <span className="font-semibold text-foreground">{staffName}</span>?
                </p>
              </div>

              {/* Stars */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className="transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      className={`w-9 h-9 transition-colors ${
                        star <= (hovered || rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-center text-sm font-medium text-yellow-500">
                  {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                </p>
              )}

              {/* Optional remarks */}
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Add a comment (optional)..."
                rows={3}
                className="w-full text-sm rounded-xl border border-input bg-muted/30 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose}>Skip</Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleSubmit}
                  disabled={!rating || submitting}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}