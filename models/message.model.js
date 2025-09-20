import mongoose, { Schema } from 'mongoose';

// Định nghĩa Schema cho tin nhắn
const messageSchema = new Schema({
    // ID của cuộc hội thoại (có thể là ID của nhóm chat hoặc ID ghép từ 2 user)
    conversationId: { type: String, required: true, index: true },
    // Người gửi tin nhắn
    sender: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    // Nội dung tin nhắn (có thể là text, link ảnh, video...)
    content: { type: String, required: true },
    // Kiểu tin nhắn: text, image, file...
    type: { type: String, default: 'text' },
    // Mảng những người đã đọc tin nhắn này
    readBy: [{ type: Schema.Types.ObjectId, ref: 'Account' }]
}, { timestamps: true });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
export default Message;