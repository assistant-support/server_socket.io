// models/message.js ( dùng cho cả server Socket.IO và Next.js )
import mongoose, { Schema } from 'mongoose';

const MessageSchema = new Schema(
    {
        room: { type: String, required: true, index: true },
        from: {
            uid: { type: String, required: true },
            name: { type: String, default: '' },
            avatar: { type: String, default: '' }
        },
        text: { type: String, required: true },
        readBy: [{ uid: String, at: Date }],  // Mảng user đã đọc (nếu cần)
        meta: {}                            // Thêm metadata tuỳ ý
    },
    { timestamps: true }
);

// Tạo index hỗ trợ truy vấn lịch sử tin nhắn theo phòng và thời gian
MessageSchema.index({ room: 1, createdAt: -1 });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
