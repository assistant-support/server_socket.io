// server_socket.io/server.js
import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import { connectMongo } from './db.js';
import Message from './models/message.js';

const app = express();
app.use(express.json());

// CORS
const originsEnv = process.env.CORS_ORIGINS || '*';
const corsOrigins = originsEnv === '*'
    ? true
    : originsEnv.split(',').map(s => s.trim());
app.use(cors({ origin: corsOrigins, credentials: true }));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

await connectMongo(process.env.MONGODB_URI);

const server = http.createServer(app);
const io = new Server(server, {
    path: '/socket.io',
    serveClient: false,
    cors: { origin: corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000
});

// ===================== AUTH MIDDLEWARE (JWT) =====================
const AUTH_SECRET =
    process.env.AUTH_SOCKET_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET;

if (!AUTH_SECRET) {
    console.warn('[io] WARNING: missing AUTH_SOCKET_SECRET/NEXTAUTH_SECRET');
}

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('no token'));
        const payload = jwt.verify(token, AUTH_SECRET); // { uid, roleId, iat, exp }
        const uid = String(payload?.uid || '');
        if (!uid) return next(new Error('invalid token payload'));

        socket.data.uid = uid;
        const roleId = payload?.roleId ? String(payload.roleId) : null;
        socket.data.roleId = roleId;

        // join rooms
        socket.join(`u:${uid}`);
        if (roleId) {
            socket.join(`role:${roleId}`);
            socket.data.roleRoom = `role:${roleId}`;
        }

        return next();
    } catch (e) {
        return next(new Error('invalid token'));
    }
});

// ===================== CONNECTION =====================
io.on('connection', (socket) => {
    console.log('[io] connected', socket.id, 'uid=', socket.data.uid, 'role=', socket.data.roleId);
    socket.emit('hello', { serverTime: Date.now(), id: socket.id });

    // ======== Chat demo (giữ nguyên) =========
    socket.on('joinRoom', ({ room, userName }, ack) => {
        if (!room) return typeof ack === 'function' && ack({ ok: false, error: 'missing room' });
        socket.join(room);
        socket.data.userName = userName || 'Guest';
        socket.to(room).emit('system', `🔔 ${socket.data.userName} đã tham gia ${room}`);
        if (typeof ack === 'function') ack({ ok: true, room });
    });

    socket.on('leaveRoom', (room, ack) => {
        socket.leave(room);
        socket.to(room).emit('system', `👋 ${socket.data.userName || socket.id} đã rời ${room}`);
        if (typeof ack === 'function') ack({ ok: true, room });
    });

    socket.on('typing', (room) => {
        if (room) socket.to(room).emit('typing', { id: socket.id, room, user: socket.data.userName || 'User' });
    });

    socket.on('chat:message', async ({ room, text, from }) => {
        try {
            if (!room || !text || !from?.uid) return;
            const doc = await Message.create({
                room,
                text,
                from: {
                    uid: String(from.uid),
                    name: from.name || '',
                    avatar: from.avatar || ''
                }
            });
            io.to(room).emit('chat:message', {
                _id: String(doc._id),
                room: doc.room,
                text: doc.text,
                from: doc.from,
                createdAt: doc.createdAt
            });
        } catch (e) {
            console.error('chat:message error', e);
            socket.emit('error:message', 'Cannot send message');
        }
    });

    socket.on('chat:delete', async ({ room, messageId, requesterUid }) => {
        try {
            if (!room || !messageId) return;
            const msg = await Message.findById(messageId);
            if (!msg) return;
            if (requesterUid !== msg.from.uid) return; // chỉ chủ tin nhắn được xóa
            await Message.findByIdAndDelete(messageId);
            io.to(room).emit('chat:delete', { messageId });
        } catch (e) {
            console.error('chat:delete error', e);
        }
    });

    socket.on('chat:read', async ({ messageId, uid }) => {
        try {
            if (!messageId || !uid) return;
            const res = await Message.findByIdAndUpdate(
                messageId,
                { $addToSet: { readBy: { uid: String(uid), at: new Date() } } },
                { new: true, lean: true }
            );
            if (res) io.to(res.room).emit('chat:read', { messageId, uid, at: Date.now() });
        } catch (e) {
            console.error('chat:read error', e);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('[io] disconnected', socket.id, 'reason=', reason);
    });
});

// REST /emit để bắn sự kiện từ Next server (admin flows, v.v.)
app.post('/emit', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ ok: false, error: 'invalid key' });
    }
    const { target, event, payload } = req.body || {};
    if (!event) return res.status(400).json({ ok: false, error: 'missing event' });

    try {
        if (target?.room) io.to(target.room).emit(event, payload);
        else io.emit(event, payload);
        console.log('[emit]', { event, target, payload });
        res.json({ ok: true, emitted: true });
    } catch (e) {
        console.error('[emit] error', e);
        res.status(500).json({ ok: false, emitted: false });
    }
});

app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

const port = Number(process.env.PORT || 5001);
server.listen(port, () => console.log(`✔ socket-service listening :${port}`));
