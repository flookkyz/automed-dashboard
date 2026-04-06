import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient>;

// IMPORTANT:
// Do not throw at module import time. Next.js evaluates modules during build
// and environments like Docker build may not provide runtime secrets.
// Instead, create a rejected promise so callers get a clear error at runtime.
if (!uri) {
  clientPromise = Promise.reject(new Error('Missing MONGODB_URI. Please set it in environment variables.'));
} else if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the value across module reloads
  if (!(global as any)._mongoClientPromise) {
    client = new MongoClient(uri, options);
    (global as any)._mongoClientPromise = client.connect();
  }
  clientPromise = (global as any)._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;