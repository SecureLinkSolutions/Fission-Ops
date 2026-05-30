import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { JwtPayload } from './types';

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.FRONTEND_URL.split(',').map((s) => s.trim()),
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Missing auth token'));
    }
    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
      (socket as Socket & { user: JwtPayload }).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as Socket & { user: JwtPayload }).user;

    socket.on('join:incident', (incidentId: string) => {
      const room = `incident:${incidentId}`;
      socket.join(room);

      // Collect presence list
      const roomSockets = io!.sockets.adapter.rooms.get(room);
      const presenceList: { userId: string; name: string; email: string }[] = [];
      if (roomSockets) {
        for (const socketId of roomSockets) {
          const s = io!.sockets.sockets.get(socketId) as Socket & { user: JwtPayload; presenceInfo?: { userId: string; name: string; email: string } } | undefined;
          if (s?.presenceInfo) presenceList.push(s.presenceInfo);
        }
      }
      socket.emit('presence:list', presenceList);

      // Broadcast join
      socket.to(room).emit('presence:join', { userId: user.sub, email: user.email });
    });

    socket.on('presence:join', (data: { incidentId: string; userId: string; name: string; email: string }) => {
      const s = socket as Socket & { presenceInfo?: { userId: string; name: string; email: string } };
      s.presenceInfo = { userId: data.userId, name: data.name, email: data.email };
      const room = `incident:${data.incidentId}`;
      socket.join(room);
      socket.to(room).emit('presence:join', s.presenceInfo);

      // Send current presence list
      const roomSockets = io!.sockets.adapter.rooms.get(room);
      const presenceList: { userId: string; name: string; email: string }[] = [];
      if (roomSockets) {
        for (const socketId of roomSockets) {
          const rs = io!.sockets.sockets.get(socketId) as Socket & { presenceInfo?: { userId: string; name: string; email: string } } | undefined;
          if (rs?.presenceInfo) presenceList.push(rs.presenceInfo);
        }
      }
      socket.emit('presence:list', presenceList);
    });

    socket.on('presence:leave', (data: { incidentId: string }) => {
      const room = `incident:${data.incidentId}`;
      socket.to(room).emit('presence:leave', { userId: user.sub, email: user.email });
      socket.leave(room);
    });

    socket.on('join:user', () => {
      socket.join(`user:${user.sub}`);
    });

    socket.on('disconnect', () => {
      // Notify all incident rooms
      for (const room of socket.rooms) {
        if (room.startsWith('incident:')) {
          socket.to(room).emit('presence:leave', { userId: user.sub, email: user.email });
        }
      }
    });
  });

  return io;
}

export function getIO(): SocketServer | null {
  return io;
}

export function emitToIncident(incidentId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`incident:${incidentId}`).emit(event, data);
  }
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}
