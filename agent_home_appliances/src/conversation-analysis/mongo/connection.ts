import mongoose, { Connection } from 'mongoose';
import { config } from 'dotenv';

config();

// Deliberately separate from src/agent/graphs/sales/tool/mongoose-connection.ts
// — this module must not import anything from src/agent/**, so it carries
// its own copy of the same lazy-connection pattern. It happens to point at
// the same MONGODB_URI database today (that's how the queue/results
// collections stay reachable by this app), but the module has no code-level
// dependency on the agent/graph layer.
let connectionPromise: Promise<Connection> | null = null;

export function getConversationAnalysisConnection(): Promise<Connection> {
  if (!connectionPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    connectionPromise = mongoose.createConnection(uri).asPromise();
  }
  return connectionPromise;
}
