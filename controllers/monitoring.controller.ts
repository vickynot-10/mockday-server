import { get_db } from "../config/mongodb";
import { send_success, send_error, send_info } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { fetchService } from "../service/fetchService";
import { MonitoringConfigSchema } from "../schema/monitor.schema";
import { BULK_UPDATE_TYPES } from "../constants/monitor.constants";
import { SaveIncidents } from "../service/saveIncidents";

function floorToHour(date: Date): Date {
  const floored = new Date(date);
  floored.setMinutes(0, 0, 0);
  return floored;
}

export async function GetMonitoringURLs(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const {
      search = "",
      project_id,
      page = "1",
      limit = "25",
    } = req.query as {
      search?: string;
      page?: string;
      limit?: string;
      project_id: string;
    };

    if (!project_id || !ObjectId.isValid(project_id)) {
      return send_error(reply, "Invalid Project", 400);
    }

    const db = get_db();
    const { fk_org_id } = req.user;

    const match: any = {
      fk_project_id: new ObjectId(project_id),
      fk_org_id: new ObjectId(fk_org_id),
    };

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
    const skip = (pageNum - 1) * limitNum;

    if (search && search.trim()) {
      match.label = { $regex: search.trim(), $options: "i" };
    }

    const BAR_COUNT = 24;
    const RANGE_MS = 24 * 60 * 60 * 1000;
    const BUCKET_MS = RANGE_MS / BAR_COUNT;

    const rangeStart = floorToHour(new Date(Date.now() - RANGE_MS));

    const data = await db
      .collection("monitoring-urls")
      .aggregate([
        { $match: match },
        {
          $lookup: {
            from: "checks",
            let: { monitorId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$fk_monitor_id", "$$monitorId"] },
                  checked_at: { $gte: rangeStart },
                },
              },
              {
                $facet: {
                  bar_data: [
                    {
                      $group: {
                        _id: {
                          $floor: {
                            $divide: [
                              { $subtract: ["$checked_at", rangeStart] },
                              BUCKET_MS,
                            ],
                          },
                        },
                        total: { $sum: 1 },
                        up: { $sum: { $cond: ["$ok", 1, 0] } },
                        actual_time: { $max: "$checked_at" },
                      },
                    },
                    {
                      $project: {
                        _id: 0,
                        bucket: "$_id",
                        time: {
                          $add: [
                            rangeStart,
                            { $multiply: ["$_id", BUCKET_MS] },
                          ],
                        },
                        actual_time: 1,
                        uptime_pct: {
                          $round: [
                            {
                              $multiply: [{ $divide: ["$up", "$total"] }, 100],
                            },
                            1,
                          ],
                        },
                      },
                    },
                  ],
                  overall: [
                    {
                      $group: {
                        _id: null,
                        total: { $sum: 1 },
                        up: { $sum: { $cond: ["$ok", 1, 0] } },
                      },
                    },
                  ],
                },
              },
            ],
            as: "checks_result",
          },
        },
        {
          $addFields: {
            bar_data: { $arrayElemAt: ["$checks_result.bar_data", 0] },
            overall: { $arrayElemAt: ["$checks_result.overall", 0] },
          },
        },
        {
          $addFields: {
            overall_uptime_pct: {
              $cond: [
                { $eq: [{ $size: "$overall" }, 0] },
                null,
                {
                  $round: [
                    {
                      $multiply: [
                        {
                          $divide: [
                            { $arrayElemAt: ["$overall.up", 0] },
                            { $arrayElemAt: ["$overall.total", 0] },
                          ],
                        },
                        100,
                      ],
                    },
                    1,
                  ],
                },
              ],
            },
          },
        },
        {
          $project: {
            label: 1,
            method: 1,
            url: 1,
            interval: 1,
            updated_on: 1,
            status: 1,
            bar_data: 1,
            overall_uptime_pct: 1,
          },
        },
        { $sort: { updated_on: -1 } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limitNum }],
            total: [{ $count: "count" }],
          },
        },
      ])
      .toArray();

    const [facetResult] = data;
    const paginatedDocs = facetResult?.data ?? [];
    const total = facetResult?.total?.[0]?.count ?? 0;

    const fillBars = (
      bars: {
        bucket: number;
        time: Date;
        actual_time: Date | null;
        uptime_pct: number;
      }[],
    ) => {
      const map = new Map(bars.map((b) => [b.bucket, b]));
      return Array.from({ length: BAR_COUNT }, (_, i) => {
        const existing = map.get(i);
        const time = new Date(rangeStart.getTime() + i * BUCKET_MS);
        return {
          time: existing ? existing.actual_time : null,
          uptime_pct: existing ? existing.uptime_pct : null,
        };
      });
    };

    const result = paginatedDocs.map((m: any) => ({
      ...m,
      bars: fillBars(m.bar_data),
      bar_data: undefined,
    }));

    return send_success(
      reply,
      {
        items: result,
        total,
      },
      200,
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetMonitoringURLConfig(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { project_id, monitor_id } = req.query as {
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

    const data = await db
      .collection("monitoring-urls")
      .aggregate([
        {
          $match: {
            fk_project_id: new ObjectId(project_id),
            _id: new ObjectId(monitor_id),
            fk_org_id: new ObjectId(fk_org_id),
          },
        },
        {
          $lookup: {
            from: "projects",
            localField: "fk_project_id",
            foreignField: "_id",
            as: "project_result",
          },
        },
        {
          $unwind: "$project_result",
        },
        {
          $addFields: {
            project_result: "$project_result.project_name",
          },
        },
      ])
      .next();

    return send_success(
      reply,

      data,

      200,
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function RunPingCheck(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { monitor_id, project_id } = req.body as {
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

    const get_url: any = await db.collection("monitoring-urls").findOne({
      _id: new ObjectId(monitor_id),
      fk_project_id: new ObjectId(project_id),
      fk_org_id: new ObjectId(fk_org_id),
    });

    if (!get_url) {
      return send_error(reply, "Monitoring API is not found", 404);
    }

    const res = await fetchService(get_url);
    const payload = {
      ...res,
      fk_monitor_id: new ObjectId(monitor_id),
      fk_project_id: new ObjectId(project_id),
      fk_org_id: new ObjectId(fk_org_id),
      checked_at: new Date(),
    };

    const insert = await db.collection("checks").insertOne(payload);
    if (!insert || !insert.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }

    await SaveIncidents(
      res.ok,
      res.status_code,
      res.error,
      monitor_id,
      project_id,
      fk_org_id,
    );

    const msg = res.ok ? "Ping Checked Successfully" : "Error Occured";

    return send_success(reply, {}, 200, msg);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function UpdateMonitorCOnfig(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const validate = MonitoringConfigSchema.safeParse(req.body);

    if (!validate.success) {
      return send_error(reply, validate.error.issues[0].message, 400);
    }

    const db = get_db();

    const { monitor_id, project_id, ...updateData } = validate.data;

    const { fk_org_id, user_id } = req.user;

    const update_config = await db.collection("monitoring-urls").updateOne(
      {
        _id: new ObjectId(monitor_id),
        fk_project_id: new ObjectId(project_id),
        fk_org_id: new ObjectId(fk_org_id),
      },
      {
        $set: {
          ...updateData,
          updated_on: new Date(),
          updated_by: new ObjectId(user_id),
        },
      },
    );

    if (!update_config || update_config.matchedCount <= 0) {
      return send_error(reply, "Monitoring API is not found", 404);
    }

    if (!update_config.acknowledged) {
      return send_error(reply, "Internal Server error", 500);
    }

    return send_success(
      reply,
      project_id,
      200,
      "Monitor URL Updated successfully !",
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function DuplicateMonitor(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { monitor_id, project_id } = req.body as any;

    if (
      !project_id ||
      !ObjectId.isValid(project_id) ||
      !monitor_id ||
      !ObjectId.isValid(monitor_id)
    ) {
      return send_error(reply, "Invalid Project", 400);
    }

    const db = get_db();
    const { fk_org_id, user_id } = req.user;

    const get_config = await db.collection("monitoring-urls").findOne(
      {
        _id: new ObjectId(monitor_id),
        fk_project_id: new ObjectId(project_id),
        fk_org_id: new ObjectId(fk_org_id),
      },
      {
        projection: {
          _id: 0,
          created_on: 0,
          updated_on: 0,
          fk_project_id: 0,
        },
      },
    );

    if (!get_config) {
      return send_error(reply, "Monitor is not found !", 404);
    }
    const id = new ObjectId();

    const payload = {
      ...get_config,
      _id: id,
      created_on: new Date(),
      updated_on: new Date(),
      fk_project_id: new ObjectId(project_id),
      fk_org_id: new ObjectId(fk_org_id),
      created_by: new ObjectId(user_id),
    };

    await Promise.all([
      db.collection("monitoring-urls").insertOne(payload),
      db.collection("projects").updateOne(
        { _id: new ObjectId(project_id), fk_org_id: new ObjectId(fk_org_id) },
        {
          $set: { updated_on: new Date(), updated_by: new ObjectId(user_id) },
          $addToSet: { monitoring_urls: id },
        },
      ),
    ]);

    return send_success(
      reply,
      project_id,
      200,
      "Monitor Duplicated successfully !",
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function RemoveMonitorConfig(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { id, fk_project_id } = req.body as any;

    if (
      !id ||
      !ObjectId.isValid(id) ||
      !fk_project_id ||
      !ObjectId.isValid(fk_project_id)
    ) {
      return send_error(reply, "Invalid Project", 400);
    }

    const db = get_db();
    const { fk_org_id, user_id } = req.user;
    await Promise.all([
      db.collection("projects").updateOne(
        {
          _id: new ObjectId(fk_project_id),
          fk_org_id: new ObjectId(fk_org_id),
        },
        {
          $pull: {
            monitoring_urls: new ObjectId(id),
          } as any,
          $set: {
            updated_on: new Date(),
            updated_by: new ObjectId(user_id),
          },
        },
      ),

      db.collection("monitoring-urls").deleteOne({
        _id: new ObjectId(id),
        fk_org_id: new ObjectId(fk_org_id),
      }),
    ]);

    return send_success(
      reply,
      fk_project_id,
      201,
      "Monitor Removed Successfully !",
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function UpdateConfigStatus(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { id, status, project_id } = req.body as any;

    if (
      !id ||
      !ObjectId.isValid(id) ||
      !project_id ||
      !ObjectId.isValid(project_id)
    ) {
      return send_error(reply, "Invalid Project", 400);
    }

    const db = get_db();

    const { fk_org_id } = req.user;

    const update_doc = await db.collection("monitoring-urls").updateOne(
      {
        _id: new ObjectId(id),
        fk_project_id: new ObjectId(project_id),
        fk_org_id: new ObjectId(fk_org_id),
      },
      {
        $set: {
          updated_on: new Date(),
          status,
        },
      },
    );
    if (!update_doc.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }
    if (update_doc.modifiedCount <= 0) {
      return send_error(reply, "Failed to update", 400);
    }

    return send_success(
      reply,
      project_id,
      201,
      "Config Status Updated Successfully !",
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function BulkUpdates(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { ids, type, status, project_id } = req.body as any;

    if (
      !ids ||
      !Array.isArray(ids) ||
      !project_id ||
      !ObjectId.isValid(project_id)
    ) {
      return send_error(reply, "Invalid Monitors or Bulk data", 400);
    }

    const filter_ids = ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (filter_ids.length <= 0) {
      return send_error(
        reply,
        "Atlease Choose 1 monitor ID for bulk Operations",
        400,
      );
    }

    const num_type = Number(type) || 1;
    const project_obj_id = new ObjectId(project_id);

    const db = get_db();

    const { fk_org_id } = req.user;
    const fk_org_obj_id = new ObjectId(fk_org_id);

    if (num_type === BULK_UPDATE_TYPES.STATUS) {
      const result = await db.collection("monitoring-urls").updateMany(
        {
          _id: { $in: filter_ids },
          fk_project_id: project_obj_id,
          fk_org_id: fk_org_obj_id,
        },
        {
          $set: {
            status,
            updated_on: new Date(),
          },
        },
      );

      if (!result.acknowledged) {
        return send_error(reply, "Internal Server Error", 500);
      }

      return send_success(
        reply,
        {},
        200,
        `${result.modifiedCount} monitor(s) updated successfully`,
      );
    }

    if (num_type === BULK_UPDATE_TYPES.RUN_CHECK) {
      const monitors = await db
        .collection("monitoring-urls")
        .find({
          _id: { $in: filter_ids },
          fk_project_id: project_obj_id,
          fk_org_id: fk_org_obj_id,
        })
        .toArray();

      if (!monitors.length) {
        return send_error(reply, "No monitors found", 404);
      }

      console.log(monitors.length , "mon lenth")

      await Promise.all(
        monitors.map(async (monitor: any) => {
          const res = await fetchService(monitor);
          await db.collection("checks").insertOne({
            ...res,
            fk_monitor_id: monitor._id,
            fk_project_id: project_obj_id,
            fk_org_id: fk_org_obj_id,
            checked_at: new Date(),
          });
          await SaveIncidents(
            res.ok,
            res.status_code,
            res.error,
            monitor._id.toString(),
            project_id,
            fk_org_id,
          );
        }),
      );

      return send_success(
        reply,
        {},
        200,
        `${monitors.length} monitor(s) checked successfully`,
      );
    }

    if (num_type === BULK_UPDATE_TYPES.DELETE) {
      await Promise.all([
        db.collection("monitoring-urls").deleteMany({
          _id: { $in: filter_ids },
          fk_project_id: project_obj_id,
          fk_org_id: fk_org_obj_id,
        }),
        db.collection("projects").updateOne(
          { _id: project_obj_id, fk_org_id: fk_org_obj_id },
          {
            $pull: { monitoring_urls: { $in: filter_ids } } as any,
            $set: { updated_on: new Date() },
          },
        ),
      ]);

      return send_success(reply, {}, 200, "Monitors deleted successfully");
    }

    return send_error(reply, "Invalid bulk operation !", 400);
  } catch (err) {
    console.log(err);
    return send_error(reply, "Internal Server Error", 500);
  }
}
