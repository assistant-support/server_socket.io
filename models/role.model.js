// /models/role.model.js
import mongoose, { Schema } from 'mongoose';

/**
 * === Role (Quyền) ===
 * - Là “gói” permission áp cho user.
 * - Mỗi binding permission trong Role có thể kèm:
 *    + conditions   : Object filter (ABAC) – giới hạn dữ liệu được phép thao tác.
 *    + allowedFields: Mảng trường được phép sửa/xem (field-level security).
 *
 * Quy ước:
 * - Role 'admin': là quyền quản trị hệ thống (isAdmin = role.name === 'admin').
 * - Role có thể 'isImmutable' để tránh bị xoá/sửa ngoài ý muốn.
 */
const RoleSchema = new Schema(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String },
        isImmutable: { type: Boolean, default: false },

        permissions: [
            {
                _id: false,
                // Trỏ về Permission – đã đồng bộ ref: 'permission' (đúng tên model)
                permission: { type: Schema.Types.ObjectId, ref: 'permission', required: true },

                // Điều kiện áp dụng (row-level). Có thể dùng biến '{{currentUser.id}}' khi evaluate phía BE.
                conditions: { type: Object, default: {} },

                // Trường được phép thao tác (field-level). ['*'] = cho phép tất cả.
                allowedFields: { type: [String], default: [] },
            },
        ],
    },
    { timestamps: true }
);

const Role = mongoose.models.role || mongoose.model('role', RoleSchema);
export default Role;
