// events/zalo.handler.js
import ZaloService from '../services/zalo.service.js';
import { logger } from '../utils/logger.js';

export const registerZaloHandlers = (io, socket) => {
    socket.on('zalo:login_request', async (data) => {
        try { await ZaloService.startLogin(socket, data?.sessionId); }
        catch (e) { logger.error('[ZaloHandlers] login_request:', e?.message || e); }
    });

    socket.on('zalo:logout', async ({ sessionId }) => {
        try { if (sessionId) await ZaloService.logoutSession(sessionId, socket); }
        catch (e) { logger.error('[ZaloHandlers] logout:', e?.message || e); }
    });

    // ✅ Gửi tin nhắn văn bản
    socket.on('zalo:send_message', async ({ sessionId, peerId, text }, ack) => {
        try {
            const msg = await ZaloService.sendText(sessionId, String(peerId), String(text || ''));
            if (typeof ack === 'function') ack({ ok: true, message: msg });
        } catch (e) {
            if (typeof ack === 'function') ack({ ok: false, error: e?.message || 'send failed' });
        }
    });
};
