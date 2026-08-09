import { FastifyInstance } from "fastify";
import { GetResumeDownloadUrl, GetResumes, MarkasDefault } from "../controllers/resume.controller";
export async function ResumeRoutes(app: FastifyInstance) {
  app.get("/", GetResumes);
  app.post("/download", GetResumeDownloadUrl);
  app.patch("/", MarkasDefault);
}
