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

// --- Cấu hình CORS ---
const originsEnv = process.env.CORS_ORIGINS || 'http://localhost:3000';
const corsOrigins = originsEnv === '*' ? true : originsEnv.split(',').map(s => s.trim());
app.use(cors({ origin: corsOrigins, credentials: true }));

// --- Health Check Endpoint ---
app.get('/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// --- Kết nối MongoDB ---
try {
    await connectMongo(process.env.MONGODB_URI);
    console.log('✔ MongoDB connected successfully.');
} catch (error) {
    console.error('✘ MongoDB connection failed:', error);
    process.exit(1);
}

// --- Khởi tạo HTTP và Socket.IO Server ---
const server = http.createServer(app);
const io = new Server(server, {
    path: '/socket.io',
    serveClient: false,
    cors: { origin: corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000
});

// ===================== AUTH MIDDLEWARE (JWT) =====================
const AUTH_SECRET = process.env.AUTH_SECRET;

if (!AUTH_SECRET) {
    console.error('✘ FATAL ERROR: AUTH_SECRET is not defined in environment variables.');
    process.exit(1);
}

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('no token'));
        }
        // Luôn xác thực bằng AUTH_SECRET
        const payload = jwt.verify(token, AUTH_SECRET);
        const uid = String(payload?.uid || '');
        if (!uid) {
            return next(new Error('invalid token payload'));
        }

        socket.data.uid = uid;
        socket.data.roleId = payload?.roleId ? String(payload.roleId) : null;

        socket.join(`u:${uid}`);
        if (socket.data.roleId) {
            socket.join(`role:${socket.data.roleId}`);
        }

        return next();
    } catch (e) {
        console.error(`[io-auth] Denied: Lỗi xác thực token. Reason: ${e.message}`);
        return next(new Error('invalid token'));
    }
});

// ===================== XỬ LÝ KẾT NỐI SOCKET =====================
io.on('connection', (socket) => {
    console.log('[io] Client connected:', {
        socketId: socket.id,
        userId: socket.data.uid,
        roleId: socket.data.roleId
    });

    // LOG QUAN TRỌNG: Kiểm tra các room mà socket này đã tham gia
    console.log(`[io] User ${socket.data.uid} is in rooms:`, Array.from(socket.rooms));
    console.log(`[io] Connected: ${socket.id} (user: ${socket.data.uid}, role: ${socket.data.roleId})`);
    socket.emit('hello', { serverTime: Date.now(), id: socket.id });
    console.log(`[io] Socket ${socket.id} for user ${socket.data.uid} has joined rooms:`, Array.from(socket.rooms));
    // Rời khỏi các room cũ khi role thay đổi (xử lý ở phía client)
    socket.on('auth:bind', ({ uid, roleId }, ack) => {
        // Rời khỏi tất cả các room `role:*` hiện tại
        socket.rooms.forEach(room => {
            if (room.startsWith('role:')) {
                socket.leave(room);
            }
        });
        // Tham gia room role mới
        if (roleId) {
            socket.join(`role:${roleId}`);
        }
        console.log(`[io] User ${uid} re-binded to role room: ${roleId}`);
        if (typeof ack === 'function') ack({ ok: true });
    });

    // ======== Các chức năng khác (giữ nguyên) =========
    // ... (Giữ lại các event 'joinRoom', 'leaveRoom', 'typing', 'chat:message', ...)

    socket.on('disconnect', (reason) => {
        console.log(`[io] Disconnected: ${socket.id} (user: ${socket.data.uid}). Reason: ${reason}`);
    });
});

// ===================== REST API ĐỂ GỬI EVENT TỪ NEXT.JS =====================
app.post('/emit', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ ok: false, error: 'Invalid API key' });
    }

    const { target, event, payload } = req.body || {};
    if (!event) {
        return res.status(400).json({ ok: false, error: 'Missing "event" in request body' });
    }

    try {
        const targetSocket = target?.room ? io.to(target.room) : io;
        targetSocket.emit(event, payload);

        console.log('[emit-api] Sent event:', { event, target, payload });
        res.json({ ok: true, emitted: true });
    } catch (e) {
        console.error('[emit-api] Error:', e);
        res.status(500).json({ ok: false, emitted: false, error: 'Internal server error' });
    }
});

// --- Middleware bắt lỗi 404 ---
app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not Found' }));

// --- Khởi động server ---
const port = Number(process.env.PORT || 5001);
server.listen(port, () => {
    console.log(`✔ Socket.IO service is running on port :${port}`);
});