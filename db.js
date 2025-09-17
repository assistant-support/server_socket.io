import mongoose from 'mongoose';

export async function connectMongo(uri) {
    if (!uri) throw new Error('Missing MONGODB_URI');
    if (mongoose.connection.readyState === 1) return mongoose;

    const isAtlas = uri.startsWith('mongodb+srv://');
    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 30000,
        maxPoolSize: 10,
        directConnection: !isAtlas,
        appName: 'server_socket.io'
    });
    return mongoose;
}
