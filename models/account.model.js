import mongoose, { Schema } from 'mongoose';

// Định nghĩa Schema cho người dùng
const accountSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false }, // Mặc định không trả về password
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    // Các thông tin khác có thể thêm sau này
    avatar: { type: String },
    isOnline: { type: Boolean, default: false }
}, { timestamps: true }); // Tự động thêm createdAt và updatedAt

// Tạo và export model
const Account = mongoose.models.Account || mongoose.model('Account', accountSchema);
export default Account;