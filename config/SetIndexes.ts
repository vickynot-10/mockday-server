import { get_db } from "./mongodb";

export async function setIndexes() {
  const db = get_db();
  console.log("Calling Indexes");

  await Promise.all([db.collection("users").createIndex({ email: 1 })]);
}
