// server_socket.io/server.js

import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import cors from 'cors'; // Đảm bảo đã import cors

// --- Sửa các đường dẫn import dưới đây ---
import { PORT, CORS_ORIGINS } from './config/environment.js';
import { connectDB } from './config/database.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { registerEventHandlers } from './events/index.js';
import { emitRouter } from './routes/emit.route.js';
import { logger } from './utils/logger.js';
// --- Kết thúc phần sửa lỗi import ---

// --- 1. Khởi tạo Server ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: CORS_ORIGINS, credentials: true },
});

// --- 2. Kết nối Cơ sở dữ liệu ---
connectDB();

// --- 3. Áp dụng Middlewares & Routes cho Express ---
app.use(cors({ origin: CORS_ORIGINS, credentials: true })); // Áp dụng CORS
app.use(express.json()); // Cho phép Express đọc JSON body
app.use(express.urlencoded({ extended: true }));

app.use('/api/emit', emitRouter(io)); // API để Next.js giao tiếp
app.get('/health', (_req, res) => res.json({ ok: true, timestamp: new Date() }));

// --- 4. Áp dụng Middleware cho Socket.IO ---
// Middleware này sẽ chạy cho MỌI kết nối mới
io.use(authMiddleware);

// --- 5. Đăng ký các trình xử lý sự kiện cho mỗi kết nối ---
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}, UserID: ${socket.data.uid}, Rooms: [${Array.from(socket.rooms).join(', ')}]`);

    // Gọi hàm đăng ký trung tâm
    registerEventHandlers(io, socket);

    socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id} (User: ${socket.data.uid}). Reason: ${reason}`);
    });
});

// --- 6. Khởi động Server ---
server.listen(PORT, () => {
    logger.info(`✔ Socket.IO service is running on port: ${PORT}`);
});