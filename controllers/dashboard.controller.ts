import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";
import { MAXIMUM_DB_CARDS } from "../constants";

export async function GetDashboard(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const fk_user_id = new ObjectId(user_id);
    const db = get_db();

    const now = new Date();

    const startOfThisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfLastWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [upcoming_reminders, status, trackers_trends] = await Promise.all([
      db
        .collection("reminders")
        .aggregate([
          {
            $match: {
              fk_user_id,
              reminder_at: { $gte: now },
            },
          },
          {
            $sort: {
              reminder_at: 1,
            },
          },
          {
            $limit: 5,
          },
          {
            $lookup: {
              from: "trackers",
              localField: "fk_tracker_id",
              foreignField: "_id",
              pipeline: [
                {
                  $match: {
                    fk_user_id,
                  },
                },
                {
                  $lookup: {
                    from: "status",
                    localField: "status",
                    foreignField: "_id",
                    as: "status",
                  },
                },
                {
                  $unwind: {
                    path: "$status",
                    preserveNullAndEmptyArrays: true,
                  },
                },
              ],
              as: "result",
            },
          },
          {
            $unwind: {
              path: "$result",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              reminder_at: 1,
              note: 1,
              company: "$result.company",
              company_notes: "$result.notes",
              company_url: "$result.url",
              company_img: "$result.image",
              applied_on: "$result.applied_on",
              title: "$result.title",
              page_title: "$result.page_title",

              status_name: "$result.status.name",
              status_color: "$result.status.color",
            },
          },
        ])
        .toArray(),

      db
        .collection("trackers")
        .aggregate([
          {
            $match: {
              fk_user_id,
            },
          },
          {
            $facet: {
              totals: [{ $count: "count" }],
              status_breakdown: [
                {
                  $group: {
                    _id: "$status",
                    count: {
                      $sum: 1,
                    },
                  },
                },
                {
                  $lookup: {
                    from: "status",
                    localField: "_id",
                    foreignField: "_id",
                    pipeline: [
                      {
                        $match: {
                          fk_user_id,
                        },
                      },
                    ],
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
                  $project: {
                    count: 1,
                    _id: 1,
                    status_name: "$result.name",
                    status_color: "$result.color",
                  },
                },
              ],
            },
          },
        ])
        .next(),

      db
        .collection("status")
        .aggregate([
          {
            $match: {
              fk_user_id,
              show_in_dashboard: true,
            },
          },
          {
            $limit: MAXIMUM_DB_CARDS,
          },
          {
            $lookup: {
              from: "trackers",
              localField: "_id",
              foreignField: "status",
              pipeline: [
                { $match: { fk_user_id } },
                {
                  $facet: {
                    totals: [{ $count: "count" }],
                    thisWeek: [
                      { $match: { applied_on: { $gte: startOfThisWeek } } },
                      { $count: "count" },
                    ],
                    lastWeek: [
                      {
                        $match: {
                          applied_on: {
                            $gte: startOfLastWeek,
                            $lt: startOfThisWeek,
                          },
                        },
                      },
                      { $count: "count" },
                    ],
                  },
                },
                {
                  $project: {
                    total: {
                      $ifNull: [{ $arrayElemAt: ["$totals.count", 0] }, 0],
                    },
                    thisWeek: {
                      $ifNull: [{ $arrayElemAt: ["$thisWeek.count", 0] }, 0],
                    },
                    lastWeek: {
                      $ifNull: [{ $arrayElemAt: ["$lastWeek.count", 0] }, 0],
                    },
                  },
                },
              ],
              as: "result",
            },
          },
          {
            $unwind: {
              path: "$result",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              status_name: "$name",
              status_color: "$color",
              total: { $ifNull: ["$result.total", 0] },
              thisWeek: { $ifNull: ["$result.thisWeek", 0] },
              lastWeek: { $ifNull: ["$result.lastWeek", 0] },
            },
          },
        ])
        .toArray(),
    ]);

    const status_breakdown = status?.status_breakdown ?? [];
    const total_applications = status?.totals?.[0]?.count ?? 0;

    return send_success(
      reply,
      {
        total_applications,
        upcoming_reminders,
        status: status_breakdown,
        trackers_trends,
      },
      200,
    );
  } catch  {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetBarChartData(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const fk_user_id = new ObjectId(user_id);
    const db = get_db();

    const { type } = req.query as { type?: string };

    const num_type = Number(type ?? 1);

    const now = new Date();

    let from_date: Date;
    let groupFormat: string;

    switch (num_type) {
      // Today → group by hour
      case 1:
        from_date = new Date(now);
        from_date.setHours(0, 0, 0, 0);

        groupFormat = "%Y-%m-%d %H:00";
        break;

      // Last 7 days → group by day
      case 2:
        from_date = new Date(now);
        from_date.setDate(from_date.getDate() - 6);

        groupFormat = "%Y-%m-%d";
        break;

      // Last 15 days → group by day
      case 3:
        from_date = new Date(now);
        from_date.setDate(from_date.getDate() - 14);

        groupFormat = "%Y-%m-%d";
        break;

      // Last 30 days → group by day
      case 4:
        from_date = new Date(now);
        from_date.setDate(from_date.getDate() - 29);

        groupFormat = "%Y-%m-%d";
        break;

      // Last 6 months → group by month
      case 5:
        from_date = new Date(now);
        from_date.setMonth(from_date.getMonth() - 5);
        from_date.setDate(1);

        groupFormat = "%Y-%m";
        break;

      // Last 1 year → group by month
      case 6:
        from_date = new Date(now);
        from_date.setMonth(from_date.getMonth() - 11);
        from_date.setDate(1);

        groupFormat = "%Y-%m";
        break;

      // Default → Today
      default:
        from_date = new Date(now);
        from_date.setHours(0, 0, 0, 0);

        groupFormat = "%Y-%m-%d %H:00";
        break;
    }

    // Start of today
    from_date.setHours(0, 0, 0, 0);

    const data = await db
      .collection("trackers")
      .aggregate([
        {
          $match: {
            fk_user_id,
            applied_on: {
              $gte: from_date,
              $lte: now,
            },
          },
        },

        {
          $group: {
            _id: {
              $dateToString: {
                format: groupFormat,
                date: "$applied_on",
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

        {
          $project: {
            _id: 0,
            date: "$_id",
            count: 1,
          },
        },
      ])
      .toArray();

    return send_success(
      reply,
      {
        type: num_type,
        from_date,
        end_date: now,
        data,
      },
      200,
    );
  } catch  {
    return send_error(reply, "Internal Server Error", 500);
  }
}
