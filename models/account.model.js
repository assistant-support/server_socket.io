
import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * @typedef {object} User
 * @property {string} name - Tên hiển thị của người dùng.
 * @property {string} email - Địa chỉ email, dùng để đăng nhập và liên lạc, là duy nhất.
 * @property {string} username - Tên người dùng công khai, duy nhất, dùng cho URL profile.
 * @property {string} password - Mật khẩu đã được mã hóa bằng bcrypt.
 * @property {string} avatar - URL đến ảnh đại diện của người dùng.
 * @property {string} role - Vai trò của người dùng trong hệ thống (ví dụ: 'user', 'admin').
 * @property {string} status - Trạng thái tài khoản (ví dụ: 'active', 'suspended').
 * @property {string} provider - Phương thức đăng ký ('credentials', 'google', 'github').
 * @property {Date} emailVerified - Dấu thời gian khi email được xác thực. Null nếu chưa xác thực.
 * @property {boolean} twoFactorEnabled - Cờ bật/tắt tính năng xác thực hai yếu tố (2FA).
 * @property {string} twoFactorSecret - Khóa bí mật 2FA, dùng để tạo mã OTP.
 * @property {string[]} twoFactorRecoveryCodes - Mảng các mã khôi phục 2FA dùng một lần.
 * @property {string} passwordResetToken - Token tạm thời để đặt lại mật khẩu.
 * @property {Date} passwordResetExpires - Thời gian hết hạn của token đặt lại mật khẩu.
 * @property {Date} createdAt - Thời gian tài khoản được tạo.
 * @property {Date} updatedAt - Thời gian thông tin tài khoản được cập nhật lần cuối.
 */

/**
 * Schema User định nghĩa cấu trúc cho một tài khoản người dùng trong MongoDB.
 * Nó bao gồm tất cả các trường cần thiết cho một hệ thống xác thực hiện đại và an toàn,
 * bao gồm thông tin cơ bản, vai trò, trạng thái, và các tính năng bảo mật nâng cao
 * như xác thực hai yếu tố (2FA) và đặt lại mật khẩu.
 *
 * Các chỉ mục (indexes) được thêm vào các trường hay được truy vấn (email, username)
 * để tối ưu hóa hiệu suất tìm kiếm.
 *
 * Một hook pre-save được sử dụng để tự động mã hóa mật khẩu trước khi lưu vào database,
 * đảm bảo rằng mật khẩu gốc không bao giờ bị lộ.
 */
const UserSchema = new Schema({
    // --- Thông tin cơ bản và định danh ---
    name: { type: String, required: true, trim: true }, // Tên đầy đủ của người dùng, bắt buộc và được cắt khoảng trắng thừa.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true }, // Email định danh, duy nhất, luôn là chữ thường và được index để truy vấn nhanh.
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true }, // Tên người dùng công khai, không bắt buộc nhưng nếu có phải là duy nhất. `sparse` cho phép nhiều document có giá trị null.
    password: { type: String, required: true, select: false }, // Mật khẩu đã được mã hóa. `select: false` để không trả về trường này trong các truy vấn mặc định.
    avatar: { type: String, default: 'https://lh3.googleusercontent.com/d/1iq7y8VE0OyFIiHmpnV_ueunNsTeHK1bG' }, // URL ảnh đại diện, có ảnh mặc định.
    // --- Phân quyền và Trạng thái ---
    role: { type: Schema.Types.ObjectId, ref: 'role' },
    status: { type: String, enum: ['active', 'pending', 'suspended', 'deactivated'], default: 'active', index: true }, // Trạng thái tài khoản, được index để lọc người dùng nhanh (ví dụ: trong trang admin).
    // --- Tích hợp NextAuth/Auth.js ---
    provider: { type: String, enum: ['credentials', 'google', 'github', 'facebook'], default: 'credentials' }, // Phương thức đăng ký, hữu ích khi dùng nhiều nhà cung cấp xác thực.
    // --- Xác thực và Bảo mật ---
    emailVerified: { type: Date, default: null }, // Lưu ngày giờ email được xác thực. Null nghĩa là chưa xác thực.
    // --- Bảo mật 2 lớp (Two-Factor Authentication) ---
    twoFactorEnabled: { type: Boolean, default: false }, // Cho biết người dùng đã bật 2FA hay chưa.
    twoFactorSecret: { type: String, select: false }, // Khóa bí mật để tạo mã TOTP, không được trả về trong truy vấn.
    twoFactorRecoveryCodes: { type: [String], select: false }, // Danh sách các mã khôi phục dự phòng, không được trả về trong truy vấn.
    // --- Khôi phục Mật khẩu ---
    passwordResetToken: { type: String, select: false }, // Token dùng một lần để reset mật khẩu.
    passwordResetExpires: { type: Date, select: false }, // Thời gian hết hạn của token reset.
    group: {
        type: String,
        enum: ['noi_khoa', 'ngoai_khoa']
    }
}, {
    // Tự động thêm hai trường createdAt và updatedAt.
    timestamps: true,
    // Cấu hình toJSON để loại bỏ mật khẩu và version key khi chuyển đổi sang JSON.
    toJSON: {
        transform(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        }
    }
});

// Middleware (hook) để mã hóa mật khẩu trước khi lưu
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        return next();
    } catch (error) {
        return next(error);
    }
});

const User = mongoose.models.account || mongoose.model('account', UserSchema);

export default User;
