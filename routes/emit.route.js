// routes/emit.route.js
import { Router } from 'express';
import { ADMIN_API_KEY } from '../config/environment.js';
import { logger } from '../utils/logger.js';

// Router này cung cấp một API endpoint an toàn để Next.js backend
// có thể ra lệnh cho Socket.IO server gửi sự kiện đi.
export const emitRouter = (io) => {
    const router = Router();

    router.post('/', (req, res) => {
        // Lớp bảo mật: Chỉ cho phép các request có API key hợp lệ
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== ADMIN_API_KEY) {
            logger.warn('Invalid API key attempt on /emit endpoint.');
            return res.status(401).json({ ok: false, error: 'Invalid API key' });
        }

        const { target, event, payload } = req.body || {};
        if (!event || !target?.room) {
            return res.status(400).json({ ok: false, error: 'Missing "event" or "target.room"' });
        }

        try {
            // Dùng `io.to()` để gửi sự kiện đến một phòng cụ thể
            io.to(target.room).emit(event, payload);
            logger.info(`[emit-api] Sent event "${event}" to room "${target.room}"`);
            res.json({ ok: true, emitted: true });
        } catch (e) {
            logger.error('[emit-api] Error:', e);
            res.status(500).json({ ok: false, error: 'Internal server error' });
        }
    });

    return router;
};