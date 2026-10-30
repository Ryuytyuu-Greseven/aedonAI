import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleAuth } from 'google-auth-library';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private db: Firestore | null = null;

  async onModuleInit(): Promise<void> {
    try {
      const auth = new GoogleAuth();
      await auth.getApplicationDefault();

      let app: App;
      if (getApps().length === 0) {
        app = initializeApp({ credential: applicationDefault() });
      } else {
        app = getApps()[0];
      }
      this.db = getFirestore(app);
      this.logger.log('Firebase Admin SDK initialized');
    } catch (err: any) {
      this.logger.warn(
        `Firebase Admin SDK not initialized (missing Google credentials): ${err.message}. Message persistence to Firestore will be skipped.`,
      );
      this.db = null;
    }
  }

  /**
   * Ensures the session document exists, then appends a message to the
   * messages subcollection.
   *
   * Schema:
   *   conversations/{sessionId}
   *     business, startedAt
   *     └── messages/{auto-id}
   *           role: 'user' | 'assistant'
   *           text: string
   *           timestamp: Timestamp
   */
  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    text: string,
    business: string,
  ): Promise<void> {
    if (!text?.trim() || !this.db) return;

    try {
      const sessionRef = this.db.collection('conversations').doc(sessionId);

      await sessionRef.set(
        { business, startedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );

      await sessionRef.collection('messages').add({
        role,
        text: text.trim(),
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (err: any) {
      this.logger.warn(`Failed to save message [${role}]: ${err.message}`);
    }
  }
}
