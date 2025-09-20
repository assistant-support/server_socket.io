// config/environment.js
import 'dotenv/config';

// File này chịu trách nhiệm tải các biến môi trường từ file .env
// và export chúng ra để toàn bộ ứng dụng có thể sử dụng.
// Việc tập trung quản lý biến môi trường ở một nơi giúp dễ dàng thay đổi và kiểm soát.

export const PORT = process.env.PORT || 5001;
export const MONGODB_URI = process.env.MONGODB_URI;
export const AUTH_SECRET = process.env.AUTH_SECRET;
export const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
export const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');

// Kiểm tra các biến môi trường quan trọng, nếu thiếu sẽ báo lỗi và thoát
if (!MONGODB_URI || !AUTH_SECRET || !ADMIN_API_KEY) {
    console.error("FATAL ERROR: Missing required environment variables. Please check your .env file.");
    process.exit(1);
}