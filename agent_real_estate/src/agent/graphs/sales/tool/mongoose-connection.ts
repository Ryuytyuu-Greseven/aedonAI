import mongoose, { Connection } from 'mongoose';
import { config } from 'dotenv';

config();

// Shared lazy Mongoose connection singleton for graph-layer stores
// (agent-lead.store.ts, sales-property.repository.ts, ...). Graph nodes are
// plain functions, not Nest-injected, so this stays outside the Nest
// DI/Mongoose module system used elsewhere (see common/llm-usage/mongodb) —
// mirrors the MongoClient singleton pattern in property.store.ts.
let connectionPromise: Promise<Connection> | null = null;

export function getMongooseConnection(): Promise<Connection> {
  if (!connectionPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    connectionPromise = mongoose.createConnection(uri).asPromise();
  }
  return connectionPromise;
}

export async function closeMongooseConnection(): Promise<void> {
  if (connectionPromise) {
    const connection = await connectionPromise;
    await connection.close();
    connectionPromise = null;
  }
}
