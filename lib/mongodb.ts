import { Db, MongoClient } from 'mongodb';

const DEFAULT_DB_NAME = process.env.MONGODB_DB || 'ishportfolio';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoLastFailAt: number | undefined;
}

const RETRY_COOLDOWN_MS = 5000;

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set.');
  }

  if (
    !globalThis._mongoClientPromise &&
    globalThis._mongoLastFailAt &&
    Date.now() - globalThis._mongoLastFailAt < RETRY_COOLDOWN_MS
  ) {
    return Promise.reject(
      new Error('MongoDB temporarily unreachable (verify Atlas Network Access IP allowlist).')
    );
  }

  if (!globalThis._mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3500,
      connectTimeoutMS: 3500,
      socketTimeoutMS: 8000,
    });
    globalThis._mongoClientPromise = client.connect().catch(err => {
      globalThis._mongoClientPromise = undefined;
      globalThis._mongoLastFailAt = Date.now();
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('SSL alert number 80') || raw.includes('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR')) {
        throw new Error(
          'MongoDB Atlas dropped the TLS handshake (SSL alert 80). Check Atlas Network Access (IP allowlist) or verify Cluster0 is not paused.'
        );
      }
      throw err;
    });
  }

  return globalThis._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(DEFAULT_DB_NAME);
}
