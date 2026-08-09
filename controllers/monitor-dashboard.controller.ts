import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
export async function MonitoringDashboard(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { monitor_id, project_id } = req.query as {
      monitor_id: string;
      project_id: string;
    };

    if (
      !project_id ||
      !ObjectId.isValid(project_id) ||
      !monitor_id ||
      !ObjectId.isValid(monitor_id)
    ) {
      return send_error(reply, "Invalid Project", 400);
    }

    const db = get_db();

    const { fk_org_id } = req.user;

    const match: any = {
      fk_project_id: new ObjectId(project_id),
      fk_org_id: new ObjectId(fk_org_id),
    };

    return send_success(reply, { ok: true }, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
