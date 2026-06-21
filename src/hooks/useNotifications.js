import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/db';

/**
 * Tracks unread notifications for the current user:
 * 1. Group chat @mentions
 * 2. New customer messages on tickets assigned to this user
 * 3. Internal staff chat notes on tickets assigned to this user
 * 4. New internal ticket assigned to this user's department
 */

const ROLE_TO_DEPT = {
  csr: 'CSR', sales: 'Sales', it: 'IT', accounting: 'Accounting',
  sign_ups: 'Sign-Ups', on_boarding: 'On-Boarding', corp_training: 'Corp/Training',
  admin: 'Admin', tl_management: 'TL/Management',
};

const STORAGE_KEY = (email) => `notif_last_seen_${email}`;

export function useNotifications(user) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]); // { type, message, ticketId?, time }
  const lastSeenRef = useRef(0);

  const getLastSeen = () => {
    if (!user?.email) return 0;
    return parseInt(localStorage.getItem(STORAGE_KEY(user.email)) || '0', 10);
  };

  const markAllRead = () => {
    if (!user?.email) return;
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY(user.email), String(now));
    lastSeenRef.current = now;
    setCount(0);
    setItems([]);
  };

  useEffect(() => {
    if (!user?.email) return;
    lastSeenRef.current = getLastSeen();
    const userDept = ROLE_TO_DEPT[user.role] ?? null;

    // --- GROUP CHAT MENTIONS ---
    const unsubGroupChat = db.GroupChatMessage.subscribe((event) => {
      if (event.type !== 'create') return;
      const msg = event.data;
      if (!msg) return;
      if (msg.sender_email === user.email) return;
      const msgTime = new Date(msg.created_date || Date.now()).getTime();
      if (msgTime <= lastSeenRef.current) return;

      // Check if user is mentioned
      const mentionPatterns = [
        `@${user.full_name}`,
        `@${user.email}`,
        ...(user.full_name ? [`@${user.full_name.split(' ')[0]}`] : []),
      ];
      const isMentioned = mentionPatterns.some(p =>
        msg.message?.toLowerCase().includes(p.toLowerCase())
      );
      if (isMentioned) {
        setItems(prev => [...prev, { type: 'mention', message: `${msg.sender_name} mentioned you in Group Chat`, time: msg.created_date }]);
        setCount(c => c + 1);
      }
    });

    // --- TICKET MESSAGES (customer replies + internal staff chat) ---
    const unsubTicketMsg = db.TicketMessage.subscribe(async (event) => {
      if (event.type !== 'create') return;
      const msg = event.data;
      if (!msg) return;
      if (msg.sender_email === user.email) return;
      const msgTime = new Date(msg.created_date || Date.now()).getTime();
      if (msgTime <= lastSeenRef.current) return;

      // Get the ticket to check assignment
      db.Ticket.get(msg.ticket_id).then(ticket => {
        if (!ticket) return;
        if (ticket.assigned_to !== user.email) return;

        if (msg.is_internal) {
          setItems(prev => [...prev, { type: 'internal_note', message: `${msg.sender_name} posted a note on ticket ${ticket.ticket_number}`, ticketId: ticket.id, time: msg.created_date }]);
        } else {
          setItems(prev => [...prev, { type: 'customer_reply', message: `${ticket.customer_name} replied on ticket ${ticket.ticket_number}`, ticketId: ticket.id, time: msg.created_date }]);
        }
        setCount(c => c + 1);
      }).catch(() => {});
    });

    // --- NEW INTERNAL TICKETS to this user's department ---
    const unsubInternal = db.InternalTicket.subscribe((event) => {
      if (event.type !== 'create') return;
      const t = event.data;
      if (!t) return;
      if (t.created_by_email === user.email) return;
      const msgTime = new Date(t.created_date || Date.now()).getTime();
      if (msgTime <= lastSeenRef.current) return;

      const isRelevant = user.role === 'super_admin' || user.role === 'tl_management'
        || (userDept && t.to_department === userDept);
      if (isRelevant) {
        setItems(prev => [...prev, { type: 'internal_ticket', message: `New internal ticket from ${t.from_department}: ${t.subject}`, time: t.created_date }]);
        setCount(c => c + 1);
      }
    });

    // --- TICKET ASSIGNMENT (newly assigned to this user) ---
    const unsubTicketAssign = db.Ticket.subscribe((event) => {
      if (event.type !== 'update') return;
      const t = event.data;
      if (!t) return;
      if (t.assigned_to !== user.email) return;
      const msgTime = new Date(t.updated_date || Date.now()).getTime();
      if (msgTime <= lastSeenRef.current) return;
      setItems(prev => [...prev, { type: 'assigned', message: `You were assigned ticket ${t.ticket_number}`, ticketId: t.id, time: t.updated_date }]);
      setCount(c => c + 1);
    });

    return () => {
      unsubGroupChat();
      unsubTicketMsg();
      unsubInternal();
      unsubTicketAssign();
    };
  }, [user?.email, user?.role]);

  return { count, items, markAllRead };
}