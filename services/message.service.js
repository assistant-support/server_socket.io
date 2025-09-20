// services/message.service.js
import Message from '../models/message.model.js';
import { logger } from '../utils/logger.js';

// Service này đóng gói logic tương tác với model Message.
// Việc này giúp tách biệt logic xử lý CSDL ra khỏi các event handler.
class MessageService {
    /**
     * Tạo và lưu một tin nhắn mới vào database.
     * @param {object} messageData - Dữ liệu của tin nhắn { conversationId, sender, content, type }
     * @returns {Promise<Document>} - Tin nhắn đã được lưu.
     */
    async createMessage(messageData) {
        try {
            const message = new Message(messageData);
            await message.save();
            logger.info(`Message saved to DB for conversation ${messageData.conversationId}`);
            return message;
        } catch (error) {
            logger.error('Error saving message to DB:', error);
            // Có thể throw lỗi để handler xử lý hoặc trả về null
            return null;
        }
    }
}

// Export một instance của service để đảm bảo tính singleton
export default new MessageService();