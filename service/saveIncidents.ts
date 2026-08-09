import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";
import { get_redis } from "../config/redis";

const OPEN_INCIDENT_PREFIX = "open_incident:";

async function getCachedOpenIncidentId(
  monitor_id: string,
): Promise<string | null> {
  const redis = get_redis();
  return redis.get(`${OPEN_INCIDENT_PREFIX}${monitor_id}`);
}

async function setCachedOpenIncidentId(
  monitor_id: string,
  incident_id: string | null,
) {
  const redis = get_redis();
  if (incident_id) {
    await redis.set(`${OPEN_INCIDENT_PREFIX}${monitor_id}`, incident_id);
  } else {
    await redis.del(`${OPEN_INCIDENT_PREFIX}${monitor_id}`);
  }
}

export async function SaveIncidents(
  isOK: boolean,
  status_code: number | null,
  error: string | null,
  monitor_id: string,
  project_id: string,
  fk_org_id: string,
) {
  const db = get_db();
  const now = new Date();

  const fk_monitor_id = new ObjectId(monitor_id);
  const fk_project_id = new ObjectId(project_id);
  const fk_org_obj_id = new ObjectId(fk_org_id);

  let cachedIncidentId = await getCachedOpenIncidentId(monitor_id);

  let openIncident = null;
  if (!cachedIncidentId) {
    openIncident = await db.collection("incidents").findOne({
      fk_monitor_id,
      ended_at: null,
    });
    if (openIncident) cachedIncidentId = openIncident._id.toString();
  }

  let incident_id: ObjectId | null = cachedIncidentId
    ? new ObjectId(cachedIncidentId)
    : null;

  if (!isOK && !incident_id) {
    const insert = await db.collection("incidents").insertOne({
      fk_monitor_id,
      fk_project_id,
      fk_org_id: fk_org_obj_id,
      started_at: now,
      ended_at: null,
      duration_ms: null,
      times: 1,
      cause: { status_code, error },
    });
    incident_id = insert.insertedId;
    await setCachedOpenIncidentId(monitor_id, incident_id.toString());
  } else if (!isOK && incident_id) {
    await db
      .collection("incidents")
      .updateOne({ _id: incident_id }, { $inc: { times: 1 } });
  }

  if (isOK && incident_id) {
    const startedAt =
      openIncident?.started_at ??
      (await db.collection("incidents").findOne({ _id: incident_id }))
        ?.started_at;
    const duration_ms = now.getTime() - startedAt.getTime();

    await db
      .collection("incidents")
      .updateOne(
        { _id: incident_id },
        { $set: { ended_at: now, duration_ms } },
      );
    await setCachedOpenIncidentId(monitor_id, null);
    incident_id = null;
  }

  if (incident_id) {
    await db.collection("incident-checks").insertOne({
      fk_monitor_id,
      fk_incident_id: incident_id,
      fk_org_id: fk_org_obj_id,
      status_code,
      error,
      occured_at: now,
    });
  }
}
