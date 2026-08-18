import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";

function getDateFilter(type: number) {
  const now = new Date();

  // Start of today
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Start of tomorrow
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (type === 1) {
    // Today
    return {
      from: startOfToday,
      to: startOfTomorrow,
    };
  }

  if (type === 2) {
    // Yesterday
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 1);

    return {
      from,
      to: startOfToday,
    };
  }

  if (type === 3) {
    // Last 3 days including today
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 2);

    return {
      from,
      to: startOfTomorrow,
    };
  }

  if (type === 4) {
    // Last 7 days including today
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 6);

    return {
      from,
      to: startOfTomorrow,
    };
  }

  if (type === 5) {
    // This month
    const from = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      from,
      to: startOfTomorrow,
    };
  }

  if (type === 6) {
    // Last month
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const to = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      from,
      to,
    };
  }

  return {
    from: startOfToday,
    to: startOfTomorrow,
  };
}

export async function GetDashboard(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { date_filter } = req.query as any;

    const date_number = Number(date_filter ?? 5);

    const { from, to } = getDateFilter(date_number);

    const db = get_db();
    const jobs = await db
      .collection("trackers")
      .aggregate([
        {
          $match: {
            fk_user_id: new ObjectId(user_id),
            applied_on: {
              $gte: from,
              $lt: to,
            },
          },
        },

        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
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
    return send_success(reply, { jobs }, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
