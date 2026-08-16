import app from "./app";
import { connectDB } from "./config/mongodb";
import dotenv from "dotenv";
import { setIndexes } from "./config/SetIndexes";
import { ConnectRedis } from "./config/redis";
import { ConnectQstash } from "./config/qstash";
dotenv.config();

async function StartServer() {
  try {
    await connectDB();
    await ConnectRedis();
    ConnectQstash();
    await setIndexes();

    await app.listen({
      port: Number(process.env.PORT) || 3001,
      host: "0.0.0.0",
    });

    app.log.info("Server started");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

StartServer();
