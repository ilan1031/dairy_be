import './env';
import * as admin from 'firebase-admin';

let firestore: admin.firestore.Firestore | null = null;
let initAttempted = false;

function projectIdFromEnv(): string | undefined {
  return process.env.FIREBASE_PROJECT_ID?.trim();
}

function parseServiceAccountFromEnv(): admin.ServiceAccount | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      return JSON.parse(json) as admin.ServiceAccount;
    } catch (err) {
      console.error('[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON:', err);
      return null;
    }
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (b64) {
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      return JSON.parse(decoded) as admin.ServiceAccount;
    } catch (err) {
      console.error('[Firebase] FIREBASE_SERVICE_ACCOUNT_BASE64 is invalid:', err);
      return null;
    }
  }

  const projectId = projectIdFromEnv();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim();

  if (!projectId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
  };
}

function initializeFirebase(): void {
  if (initAttempted) return;
  initAttempted = true;

  const serviceAccount = parseServiceAccountFromEnv();
  if (!serviceAccount) {
    console.warn(
      '[Firebase] Missing service account in .env (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY). Using local JSON store (data/).'
    );
    return;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    firestore = admin.firestore();
    firestore.settings({ ignoreUndefinedProperties: true });
    console.log(`[Firebase] Firestore connected — project: ${serviceAccount.projectId || projectIdFromEnv()}`);
  } catch (err) {
    console.error('[Firebase] Failed to initialize from .env:', err);
    firestore = null;
  }
}

export function getFirebaseProjectId(): string | undefined {
  return projectIdFromEnv();
}

export function isFirebaseConfigured(): boolean {
  initializeFirebase();
  return firestore !== null;
}

export function getFirestore(): admin.firestore.Firestore | null {
  initializeFirebase();
  return firestore;
}
