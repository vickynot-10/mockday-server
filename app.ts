import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { RegisterRoutes } from "./routes";

import cors from "@fastify/cors";
const app = Fastify({
  // logger: {
  //   transport: {
  //     target: "pino-pretty",
  //     options: {
  //       colorize: true,
  //       translateTime: "HH:MM:ss",
  //       ignore: "pid,hostname",
  //     },
  //   },
  // },
  logger: false,
});

app.register(cors, {
  origin: process.env.UI_APP || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
});


app.register(RegisterRoutes, {
  prefix: "/api",
});

app.register(cookie);

export default app;
