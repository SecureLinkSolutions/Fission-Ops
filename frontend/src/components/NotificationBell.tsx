import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { addNotificationListener } from '../hooks/useIncidentSocket';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  incident_id?: string;
  entity_id?: string;
  task_id?: string;
  read: boolean;
  created_at: string;
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const r = await apiClient.get<{ count: number }>('/notifications/unread-count');
      setUnreadCount(r.data.count);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const r = await apiClient.get<Notification[]>('/notifications');
      setNotifications(r.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);

    // Listen for socket notifications
    const removeListener = addNotificationListener(() => {
      setUnreadCount((c) => c + 1);
      if (open) fetchNotifications();
    });

    return () => {
      clearInterval(interval);
      removeListener();
    };
  }, [fetchUnreadCount, fetchNotifications, open]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleOpen() {
    const wasOpen = open;
    setOpen(!wasOpen);
    if (!wasOpen) {
      await fetchNotifications();
    }
  }

  async function handleMarkRead(id: string, notif: Notification) {
    await apiClient.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    if (!notif.incident_id) return; // informational — keep dropdown open
    setOpen(false);
    if (notif.task_id) {
      navigate(`/incidents/${notif.incident_id}?tab=tasks&task=${notif.task_id}`);
    } else if (notif.type === 'task_assigned' || notif.type === 'task_comment') {
      // legacy task notification without task_id — open tasks tab
      navigate(`/incidents/${notif.incident_id}?tab=tasks`);
    } else if (notif.entity_id) {
      navigate(`/incidents/${notif.incident_id}/entities/${notif.entity_id}`);
    } else {
      navigate(`/incidents/${notif.incident_id}`);
    }
  }

  async function handleMarkAllRead() {
    await apiClient.patch('/notifications/read-all').catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        style={{
          background: 'transparent',
          border: '1px solid #30363d',
          borderRadius: '6px',
          padding: '6px 10px',
          cursor: 'pointer',
          color: '#8b949e',
          position: 'relative',
          fontSize: '16px',
          lineHeight: 1,
        }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-6px',
            right: '-6px',
            background: '#f85149',
            color: '#fff',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: '52px',
          right: '16px',
          left: 'auto',
          bottom: 'auto',
          width: '360px',
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          maxHeight: '480px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #30363d' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#e6edf3' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ background: 'transparent', border: 'none', color: '#58a6ff', fontSize: '12px', cursor: 'pointer' }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#8b949e', fontSize: '13px' }}>
                No notifications
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleMarkRead(n.id, n)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #21262d',
                  background: n.read ? 'transparent' : '#21262d',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontWeight: n.read ? 400 : 600, color: '#e6edf3', fontSize: '13px', flex: 1 }}>{n.title}</span>
                  {!n.read && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#58a6ff', flexShrink: 0, marginTop: '4px' }} />}
                </div>
                {n.body && <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>}
                <div style={{ color: '#484f58', fontSize: '11px', marginTop: '4px' }}>{relativeTime(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
