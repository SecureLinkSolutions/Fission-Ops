import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { addToast, ToastNotification } from '../components/ToastContainer';

const SOCKET_URL = (() => {
  const base = import.meta.env.VITE_API_URL || '/api/v1';
  return base.replace(/\/api\/v1\/?$/, '');
})();

export interface PresenceUser {
  userId: string;
  name: string;
  email: string;
}

interface UseIncidentSocketOptions {
  incidentId: string;
  userId: string;
  userName: string;
  userEmail: string;
  onEntityCreated?: (data: unknown) => void;
  onEntityUpdated?: (data: unknown) => void;
  onKillchainMapped?: (data: unknown) => void;
  onKillchainUpdated?: (data: unknown) => void;
  onRelationshipCreated?: (data: unknown) => void;
  onTtpAssigned?: (data: unknown) => void;
  onCommentCreated?: (data: unknown) => void;
  onIocConfirmed?: (data: unknown) => void;
  onEntityEnriched?: (data: unknown) => void;
  onNotification?: (data: unknown) => void;
}

interface UseIncidentSocketReturn {
  connected: boolean;
  connectionState: 'connected' | 'reconnecting' | 'disconnected';
  presenceList: PresenceUser[];
}

export function useIncidentSocket(options: UseIncidentSocketOptions): UseIncidentSocketReturn {
  const { incidentId, userId, userName, userEmail } = options;
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !incidentId) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setConnectionState('connected');
      socket.emit('presence:join', {
        incidentId,
        userId,
        name: userName,
        email: userEmail,
      });
      socket.emit('join:user');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setConnectionState('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionState('reconnecting');
    });

    socket.on('reconnecting', () => {
      setConnectionState('reconnecting');
    });

    socket.on('presence:list', (list: PresenceUser[]) => {
      setPresenceList(list);
    });

    socket.on('presence:join', (user: PresenceUser) => {
      setPresenceList((prev) => {
        if (prev.find((u) => u.userId === user.userId)) return prev;
        return [...prev, user];
      });
    });

    socket.on('presence:leave', (user: { userId: string }) => {
      setPresenceList((prev) => prev.filter((u) => u.userId !== user.userId));
    });

    socket.on('entity:created', (data: unknown) => optionsRef.current.onEntityCreated?.(data));
    socket.on('entity:updated', (data: unknown) => optionsRef.current.onEntityUpdated?.(data));
    socket.on('killchain:mapped', (data: unknown) => optionsRef.current.onKillchainMapped?.(data));
    socket.on('killchain:updated', (data: unknown) => optionsRef.current.onKillchainUpdated?.(data));
    socket.on('relationship:created', (data: unknown) => optionsRef.current.onRelationshipCreated?.(data));
    socket.on('ttp:assigned', (data: unknown) => optionsRef.current.onTtpAssigned?.(data));
    socket.on('comment:created', (data: unknown) => optionsRef.current.onCommentCreated?.(data));
    socket.on('ioc:confirmed', (data: unknown) => optionsRef.current.onIocConfirmed?.(data));
    socket.on('entity:enriched', (data: unknown) => optionsRef.current.onEntityEnriched?.(data));
    socket.on('notification:new', (data: unknown) => optionsRef.current.onNotification?.(data));

    return () => {
      socket.emit('presence:leave', { incidentId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [incidentId, userId, userName, userEmail]);

  return { connected, connectionState, presenceList };
}

// Global socket for notifications (not incident-specific)
let globalSocket: Socket | null = null;
const notificationListeners: Array<(data: unknown) => void> = [];

export function getGlobalSocket(): Socket | null {
  return globalSocket;
}

export function initGlobalSocket(token: string): Socket {
  if (globalSocket) return globalSocket;
  globalSocket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  globalSocket.on('connect', () => {
    globalSocket!.emit('join:user');
  });
  globalSocket.on('notification:new', (data: unknown) => {
    notificationListeners.forEach((fn) => fn(data));
    addToast(data as ToastNotification);
  });
  return globalSocket;
}

export function addNotificationListener(fn: (data: unknown) => void): () => void {
  notificationListeners.push(fn);
  return () => {
    const idx = notificationListeners.indexOf(fn);
    if (idx >= 0) notificationListeners.splice(idx, 1);
  };
}
