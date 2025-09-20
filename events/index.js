// events/index.js
import { registerChatHandlers } from './chat.handler.js';
// import { registerNotificationHandlers } from './notification.handler.js'; // Sẽ thêm sau

/**
 * File này là một điểm đăng ký trung tâm.
 * Nó import tất cả các handler từ các file khác và gọi chúng.
 * Giúp cho file server.js luôn gọn gàng.
 */
export const registerEventHandlers = (io, socket) => {
    // Mỗi khi một tính năng real-time mới được thêm vào,
    // bạn chỉ cần đăng ký handler của nó ở đây.
    registerChatHandlers(io, socket);
    // registerNotificationHandlers(io, socket);
};