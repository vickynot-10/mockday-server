import { Client } from "@upstash/qstash";
let connection: Client | null = null;
export function ConnectQstash() {
  if (connection) return connection;

  const token = process.env.QSTASH_TOKEN;

  if (!token) {
    throw new Error("QSTASH_TOKEN is not set in environment variables");
  }

  connection = new Client({ token });
  console.log("QStash connected successfully");
  return connection;
}

export const qstash = () => {
  if (!connection) {
    throw new Error("QStash not connected yet");
  }
  return connection;
};