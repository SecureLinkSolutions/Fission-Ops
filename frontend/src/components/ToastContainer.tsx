import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { relativeTime } from '../utils/time';

export interface ToastNotification {
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

interface ToastItem {
  notif: ToastNotification;
  removing: boolean;
}

type ToastListener = (notif: ToastNotification) => void;
const toastListeners: ToastListener[] = [];

export function addToast(notif: ToastNotification): void {
  toastListeners.forEach((fn) => fn(notif));
}

function accentColor(type: string): string {
  if (type === 'task_assigned') return '#f97316';
  if (type === 'entity' || type === 'ioc') return '#58a6ff';
  return '#3fb950';
}

const MAX_TOASTS = 4;

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const navigate = useNavigate();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => t.notif.id === id ? { ...t, removing: true } : t));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.notif.id !== id));
    }, 300);
  }, []);

  const addToastInternal = useCallback((notif: ToastNotification) => {
    setToasts((prev) => {
      const next = [{ notif, removing: false }, ...prev].slice(0, MAX_TOASTS);
      return next;
    });
    setTimeout(() => removeToast(notif.id), 5000);
  }, [removeToast]);

  useEffect(() => {
    toastListeners.push(addToastInternal);
    return () => {
      const idx = toastListeners.indexOf(addToastInternal);
      if (idx >= 0) toastListeners.splice(idx, 1);
    };
  }, [addToastInternal]);

  function handleToastClick(notif: ToastNotification) {
    removeToast(notif.id);
    if (!notif.incident_id) return;
    if (notif.task_id) {
      navigate(`/incidents/${notif.incident_id}?tab=tasks&task=${notif.task_id}`);
    } else if (notif.entity_id) {
      navigate(`/incidents/${notif.incident_id}/entities/${notif.entity_id}`);
    } else {
      navigate(`/incidents/${notif.incident_id}`);
    }
  }

  if (toasts.length === 0) return null;

  return createPortal(
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 2000, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
      {toasts.map(({ notif, removing }) => {
        const accent = accentColor(notif.type);
        return (
          <div
            key={notif.id}
            style={{
              background: '#1c2128',
              border: '1px solid #30363d',
              borderLeft: `4px solid ${accent}`,
              borderRadius: '8px',
              padding: '12px 14px',
              width: '320px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              transform: removing ? 'translateX(360px)' : 'translateX(0)',
              opacity: removing ? 0 : 1,
              transition: 'transform 0.3s ease, opacity 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
            onClick={() => handleToastClick(notif)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#e6edf3', flex: 1, lineHeight: '1.3' }}>{notif.title}</span>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); removeToast(notif.id); }}
                style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '0', fontSize: '14px', lineHeight: 1, flexShrink: 0 }}
              >
                ×
              </button>
            </div>
            {notif.body && (
              <div style={{ color: '#8b949e', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.body}</div>
            )}
            <div style={{ color: '#484f58', fontSize: '11px' }}>{relativeTime(notif.created_at)}</div>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
