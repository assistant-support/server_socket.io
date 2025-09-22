// services/zalo.service.js
// QUẢN LÝ PHIÊN ZALO: đăng nhập QR → lưu cookies → giữ kết nối → đọc/gửi tin nhắn realtime.
// PHÙ HỢP API THỰC TẾ (bạn đã dump):
//   - client.loginQR() => trả về "api" có: listener(ctx, onMessageCallback...), getCookie(), getContext(), fetchAccountInfo(), getUserInfo(uid), sendMessage(...), findUser(...), ...
// LƯU Ý:
//   - Gắn lắng nghe "message" qua api.listener.on('message', ...) hoặc fallback onMessageCallback.
//   - Lưu "store" tạm thời tin nhắn & danh sách hội thoại trong bộ nhớ để phục vụ REST fetch nhanh cho web_zalo.

import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import ZaloSession from '../models/zaloSession.model.js';

// ✅ import đúng package
const zcaImport = () => import('zca-js');
const QR_FILE = path.join(process.cwd(), 'qr.png');

// Tiện ích chuẩn hoá record hội thoại
function makeConv(peerId, name = 'Unknown', avatar = '') {
    return { peerId, name, avatar, lastMessageAt: 0, unread: 0 };
}

class ZaloService {
    /**
     * activeSessions[sessionId] = {
     *   zalo, api, userId,
     *   offFns: [fn...],                         // hàm gỡ listener để tránh leak
     *   selfUid,                                 // uid của chính account này
     *   store: {
     *     conversations: Map<peerId, Conv>,
     *     messagesByPeer: Map<peerId, Array<Msg>>
     *   }
     * }
     */
    static activeSessions = {};
    static io = null;

    static setIO(io) { ZaloService.io = io; }
    static emitToUser(userId, event, payload) {
        try { ZaloService.io?.to(`user:${userId}`).emit(event, payload); } catch { }
    }

    // === Helper: gắn listener "đóng/rớt kết nối" & "nhận message" vào api.listener ===
    static _attachListeners(sessionId, api, selfUid) {
        const offFns = [];
        const onClosed = () => ZaloService._handleDisconnected(sessionId);

        // 1) Rớt kết nối (closed)
        try {
            if (api?.listener?.on) {
                api.listener.on('closed', onClosed);
                offFns.push(() => { try { api.listener.off?.('closed', onClosed); } catch { } });
            } else if ('onClosedCallback' in (api?.listener || {})) {
                const prev = api.listener.onClosedCallback;
                api.listener.onClosedCallback = (...args) => { try { prev?.(...args); } catch { } onClosed(); };
                offFns.push(() => { try { api.listener.onClosedCallback = prev; } catch { } });
            }
        } catch { }

        // 2) Nhận message realtime
        const onMessage = (raw) => {
            try {
                // Chuẩn hoá message tối thiểu: { id, peerId, direction, text, ts }
                const parsed = ZaloService._normalizeIncoming(raw, selfUid);
                if (!parsed) return;

                const active = ZaloService.activeSessions[sessionId];
                if (!active) return;
                const { store } = active;
                // Lưu vào store
                if (!store.messagesByPeer.has(parsed.peerId)) store.messagesByPeer.set(parsed.peerId, []);
                store.messagesByPeer.get(parsed.peerId).push(parsed);
                // Cập nhật hội thoại
                if (!store.conversations.has(parsed.peerId)) {
                    store.conversations.set(parsed.peerId, makeConv(parsed.peerId, parsed.peerName || 'Unknown', parsed.peerAvatar || ''));
                }
                const c = store.conversations.get(parsed.peerId);
                c.name = parsed.peerName || c.name;
                c.avatar = parsed.peerAvatar || c.avatar;
                c.lastMessageAt = parsed.ts;
                if (parsed.direction === 'in') c.unread += 1;

                // Phát về client theo room user
                ZaloService.emitToUser(active.userId, 'zalo:msg_in', { sessionId, message: parsed });
            } catch (e) {
                logger.warn('[ZaloService] onMessage parse error:', e?.message || e);
            }
        };

        try {
            if (api?.listener?.on) {
                api.listener.on('message', onMessage);
                offFns.push(() => { try { api.listener.off?.('message', onMessage); } catch { } });
            } else if ('onMessageCallback' in (api?.listener || {})) {
                const prev = api.listener.onMessageCallback;
                api.listener.onMessageCallback = (...args) => { try { prev?.(...args); } catch { } onMessage(args?.[0]); };
                offFns.push(() => { try { api.listener.onMessageCallback = prev; } catch { } });
            }
        } catch { }

        return offFns;
    }

    // === Helper: chuẩn hoá message từ raw ===
    static _normalizeIncoming(raw, selfUid) {
        if (!raw) return null;
        // Cố gắng bẻ khoá các field phổ biến
        const from = raw.fromUid || raw.from || raw.senderId || raw.sender || raw.userId;
        const to = raw.toUid || raw.to || raw.peerId || raw.recipientId;
        const text = raw?.msg?.text ?? raw?.message?.text ?? raw?.text ?? raw?.content ?? '';
        const ts = Number(raw.time || raw.timestamp || Date.now());
        const msgId = String(raw.id || raw.msgId || raw.mid || ts);
        const direction = (String(from) === String(selfUid)) ? 'out' : 'in';
        const peerId = direction === 'out' ? String(to) : String(from);

        // Thêm kèm thông tin peer nếu có sẵn
        const peerName = raw?.peerName || raw?.senderName || '';
        const peerAvatar = raw?.peerAvatar || '';

        return { id: msgId, peerId, direction, text, ts, peerName, peerAvatar };
    }

    // === Helper: lấy profile (zaloId, name, avatar, selfUid) ===
    static async _getSelfProfile(api) {
        let selfUid;
        try { selfUid = api?.getContext?.()?.uid; } catch { }
        if (!selfUid) {
            try { selfUid = await api?.getOwnId?.(); } catch { }
        }

        let profile = {};
        try {
            if (typeof api?.fetchAccountInfo === 'function') {
                profile = await api.fetchAccountInfo();
            } else if (typeof api?.getUserInfo === 'function' && selfUid) {
                profile = await api.getUserInfo(selfUid);
            }
        } catch { }
        const zaloId = profile?.id || profile?.uid || selfUid || '';
        const name = profile?.displayName || profile?.name || 'Zalo User';
        const avatar = profile?.avatarUrl || profile?.avatar || '';
        return { zaloId, name, avatar, selfUid };
    }

    // === Khởi động lại các phiên online bằng cookies khi server start ===
    static async initSessions(io) {
        ZaloService.setIO(io);
        try {
            const sessions = await ZaloSession.find({ status: 'online' }).select('+cookies');
            for (const sess of sessions) {
                const sessionId = String(sess._id);
                const userId = String(sess.user);
                if (!sess.cookies) { await ZaloSession.findByIdAndUpdate(sessionId, { status: 'offline' }); continue; }
                try {
                    const { Zalo } = await zcaImport();
                    const zalo = new Zalo({ logging: true, selfListen: true });
                    let api;
                    if (typeof zalo.loginViaCookie === 'function') api = await zalo.loginViaCookie(sess.cookies);
                    else if (typeof zalo.loginCookie === 'function') api = await zalo.loginCookie(sess.cookies);
                    else throw new Error('Thiếu hàm loginViaCookie/loginCookie');

                    const { selfUid } = await ZaloService._getSelfProfile(api);
                    const offFns = ZaloService._attachListeners(sessionId, api, selfUid);

                    ZaloService.activeSessions[sessionId] = {
                        zalo, api, userId,
                        selfUid,
                        offFns,
                        store: { conversations: new Map(), messagesByPeer: new Map() },
                    };
                    await ZaloSession.findByIdAndUpdate(sessionId, { status: 'online', lastLoginAt: new Date() });
                    logger.info(`[ZaloService] Re-login OK: ${sessionId}`);
                } catch (err) {
                    await ZaloSession.findByIdAndUpdate(sessionId, { status: 'offline', $unset: { cookies: 1 } });
                    logger.warn(`[ZaloService] Re-login FAIL: ${sessionId} → ${err.message}`);
                }
            }
        } catch (e) {
            logger.error('[ZaloService] initSessions error:', e);
        }
    }

    // === Đăng nhập QR ===
    static async startLogin(socket, sessionId = null) {
        const userId = String(socket.data.uid);
        try {
            const { Zalo } = await zcaImport();
            const zalo = new Zalo({ logging: true, selfListen: true });

            // 1) Poll file qr.png → emit base64
            let qrEmitted = false;
            const pollIntervalMs = 400, maxPollMs = 60_000, startAt = Date.now();
            const pollTimer = setInterval(() => {
                if (qrEmitted) return;
                try {
                    if (fs.existsSync(QR_FILE)) {
                        const buf = fs.readFileSync(QR_FILE);
                        socket.emit('zalo:qr', { image: buf.toString('base64') });
                        qrEmitted = true;
                        logger.info('[ZaloService] Emitted QR to client.');
                    }
                } catch { }
                if (Date.now() - startAt > maxPollMs) clearInterval(pollTimer);
            }, pollIntervalMs);

            // 2) Đợi quét xong
            let api;
            try { api = await zalo.loginQR(); } finally { clearInterval(pollTimer); }

            // 3) Cookies + profile
            let cookiesStr = '';
            try { cookiesStr = await api?.getCookie?.(); } catch { }
            const { zaloId, name, avatar, selfUid } = await ZaloService._getSelfProfile(api);

            // 4) Cập nhật DB
            const doc = await ZaloSession.findOneAndUpdate(
                { user: userId, zaloId },
                { user: userId, zaloId, name, avatar, cookies: cookiesStr, status: 'online', lastLoginAt: new Date() },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            ).lean();

            // 5) Lưu active + listener message/closed
            const sid = String(doc._id);
            const offFns = ZaloService._attachListeners(sid, api, selfUid);
            ZaloService.activeSessions[sid] = {
                zalo, api, userId, selfUid, offFns,
                store: { conversations: new Map(), messagesByPeer: new Map() },
            };

            // 6) Emit login thành công
            ZaloService.emitToUser(userId, 'zalo:login_success', doc);
            socket.emit('zalo:login_success', doc);
        } catch (e) {
            logger.error('[ZaloService] startLogin error:', e);
            socket.emit('zalo:login_error', { message: e?.message || 'Zalo login failed.' });
        }
    }

    // === Gửi tin nhắn văn bản ===
    static async sendText(sessionId, peerId, text) {
        const active = ZaloService.activeSessions[sessionId];
        if (!active) throw new Error('Session not active');
        const { api, selfUid, userId, store } = active;

        // API phổ biến: sendMessage(peerId, text) hoặc sendMessage({ to, text })
        let res;
        if (typeof api.sendMessage === 'function') {
            try {
                res = await api.sendMessage(peerId, text);
            } catch {
                res = await api.sendMessage({ to: peerId, text });
            }
        } else {
            throw new Error('API.sendMessage không khả dụng');
        }

        // Tự thêm vào store để phản hồi tức thì
        const ts = Date.now();
        const msg = { id: String(res?.id || ts), peerId: String(peerId), direction: 'out', text, ts };
        if (!store.messagesByPeer.has(peerId)) store.messagesByPeer.set(peerId, []);
        store.messagesByPeer.get(peerId).push(msg);
        if (!store.conversations.has(peerId)) store.conversations.set(peerId, makeConv(peerId));
        const c = store.conversations.get(peerId);
        c.lastMessageAt = ts;

        // Phát realtime cho các tab của user
        ZaloService.emitToUser(userId, 'zalo:msg_out', { sessionId, message: msg });
        return msg;
    }

    // === REST Getter: danh sách hội thoại từ store (fallback nếu SDK không có list) ===
    static getConversations(sessionId) {
        const active = ZaloService.activeSessions[sessionId];
        if (!active) throw new Error('Session not active');
        const list = Array.from(active.store.conversations.values());
        list.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        return list;
        // GHI CHÚ: có thể mở rộng: nếu SDK có getArchivedChatList/getPinConversations thì hợp nhất vào store ở đây.
    }

    // === REST Getter: lịch sử tin nhắn với 1 peer (từ store) ===
    static getMessages(sessionId, peerId) {
        const active = ZaloService.activeSessions[sessionId];
        if (!active) throw new Error('Session not active');
        const arr = active.store.messagesByPeer.get(String(peerId)) || [];
        return arr.slice(-200); // trả tối đa 200 tin gần nhất
    }

    // === Tìm kiếm liên hệ/số điện thoại ===
    static async search(sessionId, q) {
        const active = ZaloService.activeSessions[sessionId];
        if (!active) throw new Error('Session not active');
        const { api } = active;

        // Ưu tiên API findUser (trong dump có)
        try {
            if (typeof api.findUser === 'function') {
                const r = await api.findUser(q);
                // Chuẩn hoá: trả { peerId, name, avatar }
                const list = Array.isArray(r) ? r : (r?.items || []);
                return list.map((it) => ({
                    peerId: String(it?.id || it?.uid || it?.userId),
                    name: it?.name || it?.displayName || q,
                    avatar: it?.avatar || it?.avatarUrl || '',
                }));
            }
        } catch { }
        // Fallback rỗng
        return [];
    }

    // === Logout chủ động ===
    static async logoutSession(sessionId, socket) {
        const userId = String(socket.data.uid);
        const doc = await ZaloSession.findById(sessionId);
        if (!doc) return;
        if (String(doc.user) !== userId) return;

        await ZaloSession.findByIdAndUpdate(sessionId, { status: 'offline', $unset: { cookies: 1 } });

        const active = ZaloService.activeSessions[sessionId];
        if (active) {
            const { api, offFns } = active;
            offFns.forEach(fn => { try { fn(); } catch { } });
            try { api?.listener?.ws?.close?.(); } catch { }
            delete ZaloService.activeSessions[sessionId];
        }

        ZaloService.emitToUser(userId, 'zalo:logged_out', { id: sessionId });
    }

    // === Khi rớt kết nối ngoài ý muốn: thử login cookie, nếu fail → offline + yêu cầu QR lại ===
    static async _handleDisconnected(sessionId) {
        const active = ZaloService.activeSessions[sessionId];
        if (active) { active.offFns.forEach(fn => { try { fn(); } catch { } }); delete ZaloService.activeSessions[sessionId]; }

        const doc = await ZaloSession.findById(sessionId).select('+cookies');
        if (!doc) return;
        const userId = String(doc.user);

        if (!doc.cookies) {
            await ZaloSession.findByIdAndUpdate(sessionId, { status: 'offline' });
            ZaloService.emitToUser(userId, 'zalo:session_expired', { id: sessionId });
            return;
        }

        try {
            const { Zalo } = await zcaImport();
            const zalo = new Zalo({ logging: true, selfListen: true });
            let api;
            if (typeof zalo.loginViaCookie === 'function') api = await zalo.loginViaCookie(doc.cookies);
            else if (typeof zalo.loginCookie === 'function') api = await zalo.loginCookie(doc.cookies);
            else throw new Error('Thiếu hàm loginViaCookie/loginCookie');

            const { selfUid } = await ZaloService._getSelfProfile(api);
            const offFns = ZaloService._attachListeners(sessionId, api, selfUid);

            ZaloService.activeSessions[sessionId] = {
                zalo, api, userId, selfUid, offFns,
                // GIỮ nguyên store cũ nếu vẫn còn trong bộ nhớ (không có thì tạo mới)
                store: { conversations: new Map(), messagesByPeer: new Map() },
            };
            await ZaloSession.findByIdAndUpdate(sessionId, { status: 'online', lastLoginAt: new Date() });
            // Im lặng: UI vẫn online.
        } catch (err) {
            await ZaloSession.findByIdAndUpdate(sessionId, { status: 'offline', $unset: { cookies: 1 } });
            ZaloService.emitToUser(userId, 'zalo:session_expired', { id: sessionId });
        }
    }
}

export default ZaloService;
