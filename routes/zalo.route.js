// routes/zalo.route.js
// Router REST cho web_zalo gọi server_socket.io qua HTTP (khi cần preload).
// BẢO VỆ: dùng JWT giống socket (Authorization: Bearer <token>).

import express from 'express';
import jwt from 'jsonwebtoken';
import ZaloService from '../services/zalo.service.js';

const SECRET = process.env.SOCKET_JWT_SECRET;

export function zaloRouter() {
    const r = express.Router();

    // Middleware xác thực HTTP
    r.use((req, res, next) => {
        try {
            const h = req.headers.authorization || '';
            const token = h.startsWith('Bearer ') ? h.slice(7) : null;
            if (!token) return res.status(401).json({ error: 'unauthorized' });
            const p = jwt.verify(token, SECRET);
            req.uid = String(p.uid);
            next();
        } catch (e) {
            return res.status(401).json({ error: 'unauthorized' });
        }
    });

    // GET /api/zalo/:sessionId/conversations
    r.get('/:sessionId/conversations', (req, res) => {
        try {
            const data = ZaloService.getConversations(String(req.params.sessionId));
            return res.json({ items: data });
        } catch (e) {
            return res.status(400).json({ error: e?.message || 'bad request' });
        }
    });

    // GET /api/zalo/:sessionId/messages?peerId=xxx
    r.get('/:sessionId/messages', (req, res) => {
        try {
            const { peerId } = req.query;
            const data = ZaloService.getMessages(String(req.params.sessionId), String(peerId));
            return res.json({ items: data });
        } catch (e) {
            return res.status(400).json({ error: e?.message || 'bad request' });
        }
    });

    // GET /api/zalo/:sessionId/search?q=...
    r.get('/:sessionId/search', async (req, res) => {
        try {
            const list = await ZaloService.search(String(req.params.sessionId), String(req.query.q || ''));
            return res.json({ items: list });
        } catch (e) {
            return res.status(400).json({ error: e?.message || 'bad request' });
        }
    });

    return r;
}
