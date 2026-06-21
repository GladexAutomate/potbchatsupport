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

  // Load all unread notifications for this user
  useEffect(() => {
    if (!user?.email) return;
    
    const loadNotifications = async () => {
      try {
        const unread = await db.Notification.filter({ user_email: user.email, is_read: false }, '-created_date');
        setItems(unread || []);
        setCount((unread || []).length);
      } catch (e) {
        console.error('[useNotifications] Failed to load:', e);
      }
    };

    loadNotifications();

    // Subscribe to new notifications
    const unsub = db.Notification.subscribe((event) => {
      if (event.data?.user_email !== user.email) return;
      if (event.type === 'create' && !event.data?.is_read) {
        setItems(prev => [event.data, ...prev]);
        setCount(c => c + 1);
      }
      if (event.type === 'update' && event.data?.is_read) {
        setItems(prev => prev.filter(n => n.id !== event.data.id));
        setCount(c => Math.max(0, c - 1));
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
  useEffect(() => {
    if (!user?.email) return;
    const unsubTicketMsg = db.TicketMessage.subscribe(async (event) => {
      if (event.type !== 'create') return;
      const msg = event.data;
      if (!msg || msg.sender_email === user.email) return;

      try {
        const ticket = await db.Ticket.get(msg.ticket_id);
        if (!ticket || ticket.assigned_to !== user.email) return;

        if (msg.is_internal) {
          const redirectUrl = `/tickets?ticket_id=${ticket.id}`;
          await createNotification('internal_note', `${msg.sender_name} posted a note on ticket ${ticket.ticket_number}`, redirectUrl, ticket.id);
        } else {
          const redirectUrl = `/tickets?ticket_id=${ticket.id}`;
          await createNotification('ticket_reply', `${ticket.customer_name} replied on ticket ${ticket.ticket_number}`, redirectUrl, ticket.id);
        }
      } catch (e) {
        console.error('[useNotifications] Ticket message error:', e);
      }
    });
    return () => unsubTicketMsg();
  }, [user?.email]);

  // --- NEW INTERNAL TICKETS to this user's department ---
  useEffect(() => {
    if (!user?.email || !user?.role) return;
    const userDept = ROLE_TO_DEPT[user.role] ?? null;
    
    const unsubInternal = db.InternalTicket.subscribe((event) => {
      if (event.type !== 'create') return;
      const t = event.data;
      if (!t || t.created_by_email === user.email) return;

      const isRelevant = user.role === 'super_admin' || user.role === 'tl_management'
        || (userDept && t.to_department === userDept);
      if (isRelevant) {
        const redirectUrl = `/internal-tickets?ticket_id=${t.id}`;
        createNotification('internal_ticket', `New internal ticket from ${t.from_department}: ${t.subject}`, redirectUrl, t.id);
      }
    });
    return () => unsubInternal();
  }, [user?.email, user?.role]);

  // --- TICKET ASSIGNMENT (newly assigned to this user) ---
  useEffect(() => {
    if (!user?.email) return;
    const unsubTicketAssign = db.Ticket.subscribe((event) => {
      if (event.type !== 'update') return;
      const t = event.data;
      if (!t || t.assigned_to !== user.email) return;

      const redirectUrl = `/tickets?ticket_id=${t.id}`;
      createNotification('ticket_assignment', `You were assigned ticket ${t.ticket_number}`, redirectUrl, t.id);
    });
    return () => unsubTicketAssign();
  }, [user?.email]);

  return { count, items, markAllRead };
}