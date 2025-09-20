// utils/logger.js
// Một trình ghi log đơn giản để hiển thị thông tin có màu sắc và timestamp.
// Trong môi trường production thực tế, bạn có thể thay thế bằng các thư viện mạnh mẽ hơn như Winston hoặc Pino.

const getTimestamp = () => new Date().toISOString();

export const logger = {
    info: (message, ...args) => {
        console.log(`\x1b[34m[INFO]\x1b[0m [${getTimestamp()}] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`\x1b[33m[WARN]\x1b[0m [${getTimestamp()}] ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`\x1b[31m[ERROR]\x1b[0m [${getTimestamp()}] ${message}`, ...args);
    }
};