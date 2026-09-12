import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeToasts, setActiveToasts] = useState([]);
  const seenNotificationIds = useRef(new Set());
  const isInitialLoad = useRef(true);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const incomingList = data.notifications || [];
        setNotifications(incomingList);
        setUnreadCount(data.unreadCount || 0);

        // Check for new message notifications to trigger bottom-right popup
        if (isInitialLoad.current) {
          incomingList.forEach(n => seenNotificationIds.current.add(n.id));
          isInitialLoad.current = false;
        } else {
          const newMessages = incomingList.filter(
            n => n.type === 'message' && !seenNotificationIds.current.has(n.id)
          );

          newMessages.forEach(msg => {
            seenNotificationIds.current.add(msg.id);
            // Add to active toasts
            setActiveToasts(prev => {
              if (prev.some(t => t.id === msg.id)) return prev;
              return [...prev, msg];
            });
          });
        }
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  // Poll notifications every 3.5 seconds
  useEffect(() => {
    if (token) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 3500);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setActiveToasts([]);
      seenNotificationIds.current = new Set();
      isInitialLoad.current = true;
    }
  }, [token, user?.id]);

  // When persona switches, reset initial load flag so we don't spam toasts for already existing messages of the new persona
  useEffect(() => {
    isInitialLoad.current = true;
    seenNotificationIds.current = new Set();
  }, [user?.id]);

  const markAsRead = async (id) => {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const markAllAsRead = async () => {
    try {
      const ids = notifications.filter(n => !n.read).map(n => n.id);
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  const dismissToast = (id) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  // Helper to trigger a manual toast (e.g. for demo / testing)
  const triggerToast = (toastObj) => {
    setActiveToasts(prev => [...prev, { id: 'custom-' + Date.now(), ...toastObj }]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeToasts,
        markAsRead,
        markAllAsRead,
        dismissToast,
        triggerToast,
        fetchNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
