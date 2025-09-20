// config/database.js
import mongoose from 'mongoose';
import { MONGODB_URI } from './environment.js';
import { logger } from '../utils/logger.js';

// Hàm kết nối đến cơ sở dữ liệu MongoDB.
// Sử dụng async/await để xử lý kết nối bất đồng bộ.
export const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        logger.info('✔ MongoDB connected successfully.');
    } catch (error) {
        logger.error('✘ MongoDB connection failed:', error.message);
        // Thoát tiến trình nếu không kết nối được DB, vì đây là lỗi nghiêm trọng.
        process.exit(1);
    }
};