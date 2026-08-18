import app from "./app";
import { connectDB } from "./config/mongodb";
import dotenv from "dotenv";
import { setIndexes } from "./config/SetIndexes";
import { ConnectRedis } from "./config/redis";
import { ConnectQstash } from "./config/qstash";
import { ConnectOneSignal } from "./config/onesignal";
dotenv.config();

async function StartServer() {
  try {
    await ConnectRedis();
    await connectDB();
    ConnectQstash();
    await setIndexes();
    ConnectOneSignal();

    await import("./workers/resume_parser.worker.js")

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
