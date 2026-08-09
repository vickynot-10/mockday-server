import { FastifyInstance } from "fastify";
import {
  ProjectForm,
  GetProjectbyID,
  DeleteProjectbyID,
  GetProjectsPagination,
  GetPinnedProjects,
  UpdatePorjectStatus,
  UnPinProject,
  PinProject,BulkUpdates
} from "../controllers/projects.controller";
export async function ProjectRoutes(app: FastifyInstance) {
  app.post("/", ProjectForm);
  app.get("/", GetProjectsPagination);
  app.get("/:id", GetProjectbyID);
  app.delete("/", DeleteProjectbyID);
  app.get("/pinned-projects" , GetPinnedProjects);
  app.post("/unpin" , UnPinProject);
  app.post("/pin" , PinProject);
  app.post("/bulk-updates" , BulkUpdates);
  app.patch("/" , UpdatePorjectStatus);
}
