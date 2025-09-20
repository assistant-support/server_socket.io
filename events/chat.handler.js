// server_socket.io/events/chat.handler.js
import MessageService from '../services/message.service.js';
import { logger } from '../utils/logger.js';

// Handler này chứa tất cả logic liên quan đến chức năng chat.

const handleJoinConversation = (socket) => (conversationId) => {
    const roomName = `conversation:${conversationId}`;
    logger.info(`User ${socket.data.uid} joined conversation room: ${roomName}`);
    socket.join(roomName);
};

const handleChatMessage = (io, socket) => async (payload) => {
    const { conversationId, content, type } = payload;
    const senderId = socket.data.uid;
    const roomName = `conversation:${conversationId}`;

    logger.info(`User ${senderId} sent message to ${roomName}`);

    // 1. Lưu tin nhắn vào cơ sở dữ liệu
    const savedMessage = await MessageService.createMessage({
        conversationId,
        sender: senderId,
        content,
        type: type || 'text'
    });

    if (!savedMessage) {
        socket.emit('chat:error', { message: 'Failed to send message.' });
        return;
    }

    // --- PHẦN SỬA LỖI QUAN TRỌNG ---
    // 2. Gửi tin nhắn đến tất cả mọi người trong phòng chat, BAO GỒM CẢ NGƯỜI GỬI.
    // Thay thế `socket.to(roomName)` bằng `io.to(roomName)`
    io.to(roomName).emit('chat:new_message', savedMessage.toObject()); // Dùng .toObject() để đảm bảo gửi đi là plain object
    // --- KẾT THÚC PHẦN SỬA LỖI ---
};

// Đăng ký tất cả các handler liên quan đến chat
export const registerChatHandlers = (io, socket) => {
    socket.on('chat:join', handleJoinConversation(socket));
    socket.on('chat:message', handleChatMessage(io, socket));
};