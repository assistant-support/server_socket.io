import mongoose, { Schema } from 'mongoose';

// Định nghĩa Schema cho vai trò (quyền hạn)
const roleSchema = new Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    // Mảng chứa các ID của các quyền (permissions) mà vai trò này có
    permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }]
}, { timestamps: true });

const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);
export default Role;