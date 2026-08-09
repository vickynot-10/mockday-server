import { get_db } from "../config/mongodb";
import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";

export async function GetIncidentsWithStats(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const {
      project_id,
      monitor_id,
      type,
      start_date,
      end_date,
      search = "",
      page = "1",
      limit = "25",
    } = req.query as {
      project_id?: string;
      monitor_id?: string;
      type: "all" | "open" | "resolved";
      start_date?: string;
      end_date?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const db = get_db();
    const { fk_org_id } = req.user;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(25, Number(limit) || 25);
    const skip = (pageNum - 1) * limitNum;

    const match: any = { fk_org_id: new ObjectId(fk_org_id) };

    if (project_id && ObjectId.isValid(project_id)) {
      match.fk_project_id = new ObjectId(project_id);
    }
    if (monitor_id && ObjectId.isValid(monitor_id)) {
      match.fk_monitor_id = new ObjectId(monitor_id);
    }
    if (type === "open") match.ended_at = null;
    if (type === "resolved") match.ended_at = { $ne: null };
    if (start_date || end_date) {
      match.started_at = {};
      if (start_date) match.started_at.$gte = new Date(start_date);
      if (end_date) match.started_at.$lte = new Date(end_date);
    }

    const searchStage: any[] =
      search && search.trim()
        ? [
            {
              $match: {
                $or: [
                  { "monitor.label": { $regex: search.trim(), $options: "i" } },
                  { "monitor.url": { $regex: search.trim(), $options: "i" } },
                ],
              },
            },
          ]
        : [];

    const pipeline = [
      { $match: match },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                ongoing: {
                  $sum: { $cond: [{ $eq: ["$ended_at", null] }, 1, 0] },
                },
                total_failed: { $sum: "$times" },
                avg_duration: {
                  $avg: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$ended_at", null] },
                          { $ne: ["$duration_ms", null] },
                        ],
                      },
                      "$duration_ms",
                      null,
                    ],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                total: 1,
                ongoing: 1,
                total_failed: 1,
                avg_duration: { $round: ["$avg_duration", 0] },
              },
            },
          ],

          list: [
            {
              $lookup: {
                from: "monitoring-urls",
                localField: "fk_monitor_id",
                foreignField: "_id",
                as: "monitor",
              },
            },
            { $unwind: "$monitor" },
            ...searchStage,
            {
              $project: {
                started_at: 1,
                ended_at: 1,
                duration_ms: 1,
                times: 1,
                cause: 1,
                monitor_label: "$monitor.label",
                monitor_url: "$monitor.url",
              },
            },
            { $sort: { started_at: -1 } },
            { $skip: skip },
            { $limit: limitNum },
          ],

          total: [
            {
              $lookup: {
                from: "monitoring-urls",
                localField: "fk_monitor_id",
                foreignField: "_id",
                as: "monitor",
              },
            },
            { $unwind: "$monitor" },
            ...searchStage,
            { $count: "count" },
          ],
        },
      },
    ];

    const [result] = await db
      .collection("incidents")
      .aggregate(pipeline)
      .toArray();

    const items = result?.list ?? [];
    const total = result?.total?.[0]?.count ?? 0;
    const summary = result?.summary?.[0] ?? {
      total: 0,
      ongoing: 0,
      total_failed: 0,
      avg_duration: 0,
    };

    return send_success(
      reply,
      {
        items,
        total,
        summary,
      },
      200,
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetIncidentsForCharts(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { incident_id, start_date, end_date } = req.query as {
      incident_id: string;
      start_date?: string;
      end_date?: string;
    };

    if (!incident_id || !ObjectId.isValid(incident_id)) {
      return send_error(reply, "Invalid Incident");
    }

    const db = get_db();
    const { fk_org_id } = req.user;

    const match: any = {
      fk_org_id: new ObjectId(fk_org_id),
      _id: new ObjectId(incident_id),
    };

    const incident_match: any = {
      fk_org_id: new ObjectId(fk_org_id),
      fk_incident_id: new ObjectId(incident_id),
    };

    if (start_date || end_date) {
      match.started_at = {};
      incident_match.occured_at = {};
      if (start_date) {
        match.started_at.$gte = new Date(start_date);
        incident_match.occured_at.$gte = new Date(start_date);
      }
      if (end_date) {
        match.started_at.$lte = new Date(end_date);

        incident_match.occured_at.$lte = new Date(end_date);
      }
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "monitoring-urls",
          localField: "fk_monitor_id",
          foreignField: "_id",
          as: "result",
        },
      },
      {
        $unwind: {
          path: "$result",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: null,
          monitor_name: { $first: "$result.label" },

          started_at: { $first: "$started_at" },
          monitor_url: { $first: "$result.url" },
          ended_at: { $first: "$ended_at" },
          ongoing: {
            $sum: {
              $cond: [{ $eq: ["$ended_at", null] }, 1, 0],
            },
          },
          total_failed: { $sum: "$times" },
          avg_duration: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$ended_at", null] },
                    { $ne: ["$duration_ms", null] },
                  ],
                },
                "$duration_ms",
                null,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          ongoing: 1,
          monitor_name: 1,
          started_at: 1,
          monitor_url: 1,
          ended_at: 1,
          total_failed: 1,
          avg_duration: {
            $round: ["$avg_duration", 0],
          },
        },
      },
    ];

    const [data, checksResult] = await Promise.all([
      db.collection("incidents").aggregate(pipeline).next(),
      db
        .collection("incident-checks")
        .aggregate([
          { $match: incident_match },
          {
            $facet: {
            
              logs: [
                {
                  $group: {
                    _id: {
                      $dateTrunc: {
                        date: "$occured_at",
                        unit: "day",
                      },
                    },
                    count: {
                      $sum: 1,
                    },
                  },
                },
                {
                  $sort: {
                    _id: 1,
                  },
                },
              ],
            },
          },
        ])
        .next(),
    ]);

   
    const chart_logs = checksResult?.logs ?? [];

    return send_success(reply, { data, chart_logs }, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetProjectsAndMonitorData(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { fk_org_id } = req.user;

    const db = get_db();

    const monitors = await db
      .collection("projects")
      .aggregate([
        {
          $match: {
            fk_org_id: new ObjectId(fk_org_id),
          },
        },
        {
          $lookup: {
            from: "monitoring-urls",
            localField: "monitoring_urls",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  label: 1,
                  _id: 1,
                },
              },
            ],
            as: "monitors",
          },
        },
        {
          $project: {
            project_name: 1,
            _id: 1,
            monitors: 1,
          },
        },
      ])
      .toArray();

    return send_success(reply, monitors, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetIncidentsLogs(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { incident_id, sort, cursor, start_date, end_date } = req.query as {
      incident_id: string;
      sort: string;
      cursor?: string;
      start_date?: string;
      end_date?: string;
    };

    if (!incident_id || !ObjectId.isValid(incident_id)) {
      return send_error(reply, "Invalid Incident");
    }

    const db = get_db();
    const { fk_org_id } = req.user;

    const sort_num: 1 | -1 = Number(sort) === -1 ? -1 : 1;
    const limit = 50;

    const incident_match: any = {
      fk_org_id: new ObjectId(fk_org_id),
      fk_incident_id: new ObjectId(incident_id),
    };

    if (start_date || end_date) {
      incident_match.occured_at = {};
      if (start_date) incident_match.occured_at.$gte = new Date(start_date);
      if (end_date) incident_match.occured_at.$lte = new Date(end_date);
    }

    if (cursor && ObjectId.isValid(cursor)) {
      incident_match._id =
        sort_num === 1
          ? { $gt: new ObjectId(cursor) }
          : { $lt: new ObjectId(cursor) };
    }

    const logs = await db
      .collection("incident-checks")
      .find(incident_match, {
        projection: {
          fk_incident_id: 0,
          fk_org_id: 0,
          fk_monitor_id: 0,
        },
      })
      .sort({ _id: sort_num })
      .limit(limit + 1)
      .toArray();

    const has_more = logs.length > limit;
    const items = has_more ? logs.slice(0, limit) : logs;
    const next_cursor = has_more ? items[items.length - 1]._id : null;

    return send_success(reply, { items, next_cursor }, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
