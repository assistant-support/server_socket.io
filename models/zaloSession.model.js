// models/zaloSession.model.js - Định nghĩa model cho phiên đăng nhập Zalo (tài khoản Zalo được quản lý)
import mongoose, { Schema } from 'mongoose';

const zaloSessionSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },           // Người sở hữu (tài khoản panel)
    zaloId: { type: String, required: true },                                                    // ID định danh tài khoản Zalo (UID Zalo)
    name: { type: String, required: true },                                                      // Tên hiển thị của tài khoản Zalo
    avatar: { type: String, default: '' },                                                       // Ảnh đại diện (URL) của tài khoản Zalo
    status: { type: String, enum: ['online', 'offline'], default: 'offline' },                   // Trạng thái đăng nhập (online: đang đăng nhập, offline: đã đăng xuất)
    lastLoginAt: { type: Date, default: Date.now },                                              // Thời điểm đăng nhập gần nhất
    cookies: { type: Schema.Types.Mixed, select: false }                                         // Cookie phiên đăng nhập (lưu để đăng nhập lại), không select mặc định vì nhạy cảm
}, { timestamps: true }); // Mongoose sẽ tự động thêm createdAt, updatedAt

// Tạo chỉ mục để đảm bảo mỗi user chỉ có một phiên cho mỗi tài khoản Zalo (tránh trùng lặp zaloId cho cùng một user)
zaloSessionSchema.index({ user: 1, zaloId: 1 }, { unique: true });

// Khởi tạo model (tránh tạo lại nếu đã tồn tại)
const ZaloSession = mongoose.models.ZaloSession || mongoose.model('ZaloSession', zaloSessionSchema);
export default ZaloSession;
