import { Db, MongoClient } from 'mongodb';

const DEFAULT_DB_NAME = process.env.MONGODB_DB || 'ishportfolio';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoLastFailAt: number | undefined;
  // eslint-disable-next-line no-var
  var _mongoLastFailMessage: string | undefined;
}

const RETRY_COOLDOWN_MS = 5000;

function normalizeMongoUri(rawUri: string | undefined): string {
  const trimmed = (rawUri || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function sanitizeMongoError(message: string): string {
  return message.replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, 'mongodb$1://<redacted>@');
}

function getClientPromise(): Promise<MongoClient> {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set.');
  }

  if (
    !globalThis._mongoClientPromise &&
    globalThis._mongoLastFailAt &&
    Date.now() - globalThis._mongoLastFailAt < RETRY_COOLDOWN_MS
  ) {
    return Promise.reject(
      new Error(
        globalThis._mongoLastFailMessage ||
          'MongoDB temporarily unreachable (verify Atlas Network Access IP allowlist).'
      )
    );
  }

  if (!globalThis._mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 15000,
      autoSelectFamily: false,
    });
    globalThis._mongoClientPromise = client
      .connect()
      .then(connectedClient => {
        globalThis._mongoLastFailAt = undefined;
        globalThis._mongoLastFailMessage = undefined;
        return connectedClient;
      })
      .catch(err => {
        globalThis._mongoClientPromise = undefined;
        globalThis._mongoLastFailAt = Date.now();
        const raw = sanitizeMongoError(err instanceof Error ? err.message : String(err));
        const formatted =
          raw.includes('SSL alert number 80') || raw.includes('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR')
            ? `MongoDB Atlas dropped the TLS handshake (SSL alert 80). For Vercel, add 0.0.0.0/0 to Atlas Network Access (IP Access List) since serverless IPs are dynamic, verify Cluster0 is not paused, and confirm MONGODB_URI in Vercel has no typos (${raw}).`
            : raw;
        globalThis._mongoLastFailMessage = formatted;
        throw new Error(formatted);
      });
  }

  return globalThis._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(DEFAULT_DB_NAME);
}
