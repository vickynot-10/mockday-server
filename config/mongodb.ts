import { MongoClient, Db } from "mongodb";

let client: MongoClient;
let db: Db;

export const connectDB = async () => {
  if (db) return db;

  const mongo_uri = process.env.MONGO_URI;

  if (!mongo_uri) {
    throw new Error("MONGO_URI not set");
  }

  try {
    client = new MongoClient(mongo_uri);
    await client.connect();
    db = client.db();
    console.log("mongodb connected");
    return db;
  } catch (err) {
    console.error("mongodb connection failed", err);
    process.exit(1);
  }
};

export const get_db = () => {
  if (!db) {
    throw new Error("db not connected yet");
  }
  return db;
};

export const disconnect_db = async () => {
  if (client) await client.close();
};
