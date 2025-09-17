// /models/permission.model.js
import mongoose, { Schema } from 'mongoose';

/**
 * === Permission (Chức năng) ===
 * - Mục tiêu: định nghĩa "hành động cụ thể" có thể cấp cho Role (vd: user:list, user:update).
 * - Dùng ở UI và BE để kiểm soát: "ai được phép làm gì".
 *
 * Trường bắt buộc:
 *  - action       : Mã hành động (duy nhất). Ví dụ: 'user:list', 'user:update'.
 *  - group        : Nhóm chức năng (giúp gom & lọc trên UI). Ví dụ: 'Users', 'Products'.
 *  - description  : Mô tả chi tiết để team hiểu tác dụng.
 *
 * Trường tiện ích cho UI/Quy ước:
 *  - label        : Tên hiển thị thân thiện (vd: 'Xem người dùng'). Nếu không set, backend có thể fallback = action.
 *  - tags         : Mảng tag để lọc/gợi ý (vd: ['users','read']). Dùng tự do theo nhu cầu team.
 *
 * Ghi chú quản lý:
 *  - Không gắn điều kiện (conditions) hay allowedFields ở đây. Những thứ đó thuộc "binding" khi gán vào Role,
 *    vì mỗi Role có thể dùng cùng 1 Permission với điều kiện khác nhau (ABAC).
 */
const PermissionSchema = new Schema(
    {
        action: { type: String, required: true, unique: true, trim: true, index: true },
        group: { type: String, required: true, trim: true },
        description: { type: String, required: true },

        // Tên hiển thị cho UI/biểu mẫu gán quyền (không bắt buộc)
        label: { type: String, default: '' },

        // Gắn nhãn để tìm/nhóm permission nhanh (không bắt buộc)
        tags: { type: [String], default: [], index: true },
    },
    {
        timestamps: true,
    }
);

// Đăng ký model 1 lần cho connection hiện tại
const Permission =
    mongoose.models.permission || mongoose.model('permission', PermissionSchema);

export default Permission;
