import { FastifyInstance } from "fastify";
import { DeleteResumes, GetResumeDownloadUrl, GetResumes, MarkasDefault } from "../controllers/resume.controller";
export async function ResumeRoutes(app: FastifyInstance) {
  app.get("/", GetResumes);
  app.post("/download", GetResumeDownloadUrl);
  app.patch("/", MarkasDefault);
  app.post("/delete", DeleteResumes);
}
