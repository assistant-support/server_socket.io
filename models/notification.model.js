import mongoose, { Schema } from 'mongoose';

// Định nghĩa Schema cho thông báo
const notificationSchema = new Schema({
    // Người nhận thông báo
    recipient: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    // Nội dung thông báo
    content: { type: String, required: true },
    // Loại thông báo: new_message, friend_request, system_update...
    type: { type: String, required: true },
    // Trạng thái đã đọc hay chưa
    isRead: { type: Boolean, default: false },
    // Link để khi click vào thông báo sẽ điều hướng tới
    link: { type: String }
}, { timestamps: true });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;