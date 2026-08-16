import { Client } from "@upstash/qstash";
let connection: Client | null = null;
export function ConnectQstash() {
  if (connection) return connection;

  const token = process.env.QSTASH_TOKEN;
   const baseUrl = process.env.QSTASH_URL;

  if (!token || !baseUrl) {
    throw new Error("Invalid Config for Qstash");
  }

  connection = new Client({ token , baseUrl });
  console.log("QStash connected successfully");
  return connection;
}

export const qstash = () => {
  if (!connection) {
    throw new Error("QStash not connected yet");
  }
  return connection;
};