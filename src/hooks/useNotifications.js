import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/db';

/**
 * Tracks notifications for the current user, persisted in Notification database:
 * 1. Group chat @mentions
 * 2. New customer messages on tickets assigned to this user
 * 3. Internal staff chat notes on tickets assigned to this user
 * 4. New internal ticket assigned to this user's department
 * 5. Ticket assignment
 */

const ROLE_TO_DEPT = {
  csr: 'CSR', sales: 'Sales', it: 'IT', accounting: 'Accounting',
  sign_ups: 'Sign-Ups', on_boarding: 'On-Boarding', corp_training: 'Corp/Training',
  admin: 'Admin', tl_management: 'TL/Management',
};

export function useNotifications(user) {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]); // Notifications from database
  const userDeptRef = useRef(null);

  // Load all notifications (read + unread) for history, but count only unread
  useEffect(() => {
    if (!user?.email) return;
    
    const loadNotifications = async () => {
      try {
        const all = await db.Notification.filter({ user_email: user.email }, '-created_date');
        setItems(all || []);
        const unreadCount = (all || []).filter(n => !n.is_read).length;
        setCount(unreadCount);
      } catch (e) {
        console.error('[useNotifications] Failed to load:', e);
      }
    };

    loadNotifications();

    // Subscribe to new notifications and updates
    const unsub = db.Notification.subscribe((event) => {
      if (event.data?.user_email !== user.email) return;
      if (event.type === 'create') {
        setItems(prev => [event.data, ...prev]);
        if (!event.data?.is_read) setCount(c => c + 1);
      }
      if (event.type === 'update') {
        if (event.data?.is_read) {
          setItems(prev => prev.map(n => n.id === event.data.id ? event.data : n));
          setCount(c => Math.max(0, c - 1));
        }
      }
    });

    return () => unsub();
  }, [user?.email]);

  const createNotification = async (type, message, redirectUrl, sourceId = null) => {
    if (!user?.email) return;
    try {
      await db.Notification.create({
        user_email: user.email,
        message,
        type,
        redirect_url: redirectUrl,
        source_id: sourceId,
        is_read: false,
      });
    } catch (e) {
      console.error('[useNotifications] Failed to create:', e);
    }
  };

  const markAllRead = async () => {
    if (!user?.email) return;
    try {
      for (const notif of items) {
        await db.Notification.update(notif.id, { is_read: true });
      }
      setItems([]);
      setCount(0);
    } catch (e) {
      console.error('[useNotifications] Failed to mark read:', e);
    }
  };

  // --- GROUP CHAT MENTIONS ---
  useEffect(() => {
    if (!user?.email) return;
    const unsubGroupChat = db.GroupChatMessage.subscribe((event) => {
      if (event.type !== 'create') return;
      const msg = event.data;
      if (!msg || msg.sender_email === user.email) return;

      const mentionPatterns = [
        `@${user.full_name}`,
        `@${user.email}`,
        ...(user.full_name ? [`@${user.full_name.split(' ')[0]}`] : []),
      ];
      const isMentioned = mentionPatterns.some(p =>
        msg.message?.toLowerCase().includes(p.toLowerCase())
      );
      if (isMentioned) {
        const redirectUrl = `/group-chat?message_id=${msg.id}`;
        createNotification('group_chat_mention', `${msg.sender_name} mentioned you in Group Chat`, redirectUrl, msg.id);
      }
    });
    return () => unsubGroupChat();
  }, [user?.email, user?.full_name]);

  // --- TICKET MESSAGES (customer replies + internal staff chat) ---
  // Debounced to prevent DB read storms under high traffic: events are batched
  // within a 2s window; only one DB fetch fires per burst of rapid messages.
  useEffect(() => {
    if (!user?.email) return;
    const pendingMsgs = [];
    let debounceTimer = null;

    const processBatch = async () => {
      const batch = pendingMsgs.splice(0);
      if (!batch.length) return;
      // Deduplicate by ticket_id so we only fetch each ticket once per burst
      const byTicket = {};
      for (const msg of batch) {
        if (!byTicket[msg.ticket_id]) byTicket[msg.ticket_id] = msg;
      }
      for (const [ticketId, msg] of Object.entries(byTicket)) {
        try {
          const ticket = await db.Ticket.get(ticketId);
          if (!ticket || ticket.assigned_to !== user.email) continue;
          if (msg.is_internal) {
            await createNotification('internal_note', `${msg.sender_name} posted a note on ticket ${ticket.ticket_number}`, `/tickets?ticket_id=${ticket.id}`, ticket.id);
          } else {
            await createNotification('ticket_reply', `${ticket.customer_name} replied on ticket ${ticket.ticket_number}`, `/tickets?ticket_id=${ticket.id}`, ticket.id);
          }
        } catch (e) {
          console.error('[useNotifications] Ticket message error:', e);
        }
      }
    };

    const unsubTicketMsg = db.TicketMessage.subscribe((event) => {
      if (event.type !== 'create') return;
      const msg = event.data;
      if (!msg || msg.sender_email === user.email) return;
      pendingMsgs.push(msg);
      clearTimeout(debounceTimer);
      // Random jitter (0–500ms) prevents all connected clients from hitting DB simultaneously
      debounceTimer = setTimeout(processBatch, 2000 + Math.random() * 500);
    });

    return () => { clearTimeout(debounceTimer); unsubTicketMsg(); };
  }, [user?.email]);

  // --- NEW INTERNAL TICKETS to this user's department ---
  useEffect(() => {
    if (!user?.email || !user?.role) return;
    const userDept = ROLE_TO_DEPT[user.role] ?? null;
    let debounceTimer = null;
    const pendingTickets = [];

    const processBatch = () => {
      const batch = pendingTickets.splice(0);
      for (const t of batch) {
        const redirectUrl = `/internal-tickets?ticket_id=${t.id}`;
        createNotification('internal_ticket', `New internal ticket from ${t.from_department}: ${t.subject}`, redirectUrl, t.id);
      }
    };

    const unsubInternal = db.InternalTicket.subscribe((event) => {
      if (event.type !== 'create') return;
      const t = event.data;
      if (!t || t.created_by_email === user.email) return;
      const isRelevant = user.role === 'super_admin' || user.role === 'tl_management'
        || (userDept && t.to_department === userDept);
      if (isRelevant) {
        pendingTickets.push(t);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processBatch, 1500 + Math.random() * 500);
      }
    });
    return () => { clearTimeout(debounceTimer); unsubInternal(); };
  }, [user?.email, user?.role]);

  // --- TICKET ASSIGNMENT (newly assigned to this user) ---
  useEffect(() => {
    if (!user?.email) return;
    let debounceTimer = null;
    let lastAssigned = null;

    const unsubTicketAssign = db.Ticket.subscribe((event) => {
      if (event.type !== 'update') return;
      const t = event.data;
      if (!t || t.assigned_to !== user.email) return;
      // Deduplicate: don't fire twice for the same ticket assignment event
      if (lastAssigned === t.id) return;
      lastAssigned = t.id;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        createNotification('ticket_assignment', `You were assigned ticket ${t.ticket_number}`, `/tickets?ticket_id=${t.id}`, t.id);
        lastAssigned = null;
      }, 1000 + Math.random() * 500);
    });
    return () => { clearTimeout(debounceTimer); unsubTicketAssign(); };
  }, [user?.email]);

  return { count, items, markAllRead };
}