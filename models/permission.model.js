import mongoose, { Schema } from 'mongoose';

// Định nghĩa Schema cho các quyền (chức năng) cụ thể
const permissionSchema = new Schema({
    // Tên quyền, ví dụ: 'users:create', 'users:read', 'chat:send'
    name: { type: String, required: true, unique: true },
    // Mô tả để giải thích quyền này dùng để làm gì
    description: { type: String }
}, { timestamps: true });

const Permission = mongoose.models.Permission || mongoose.model('Permission', permissionSchema);
export default Permission;