// server.js (chỉ bổ sung router zalo; giữ nguyên cấu trúc cũ)
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import cors from 'cors';
import { PORT, CORS_ORIGINS } from './config/environment.js';
import { connectDB } from './config/database.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { registerEventHandlers } from './events/index.js';
import { emitRouter } from './routes/emit.route.js';
import { zaloRouter } from './routes/zalo.route.js';
import { logger } from './utils/logger.js';
import ZaloService from './services/zalo.service.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { path: '/socket.io', cors: { origin: CORS_ORIGINS, credentials: true } });

await connectDB();
await ZaloService.initSessions(io); // nếu muốn tự re-login

app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/emit', emitRouter(io));
app.use('/api/zalo', zaloRouter()); // ✅ REST cho chat
app.get('/health', (_req, res) => res.json({ ok: true }));

io.use(authMiddleware);
io.on('connection', (socket) => {
    // Khuyến nghị: join room user:<uid> để broadcast theo user
    try { socket.join(`user:${socket.data.uid}`); } catch { }
    registerEventHandlers(io, socket);
    socket.on('disconnect', () => { });
});

server.listen(PORT, () => logger.info(`✔ Socket.IO service is running on port: ${PORT}`));
