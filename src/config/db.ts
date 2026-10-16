import mongoose from 'mongoose';
import { env, isProd } from './env';

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => console.log('MongoDB connected'));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    // Building indexes on every boot is fine in dev; in production indexes are
    // synced explicitly (seed/migration script) so app start stays fast.
    autoIndex: !isProd,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
