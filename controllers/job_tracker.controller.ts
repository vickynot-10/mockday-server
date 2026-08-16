import { send_success, send_error, send_info } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";
import {
  JobUpdateStatusSchema,
  TrackerSaveSchema,
  SaveReminderSchema,
} from "../schema/job_tracker.schema";

export async function GetTrackers(req: FastifyRequest, reply: FastifyReply) {
  try {
    const db = get_db();
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const {
      page = 1,
      limit = 25,
      sort = -1,
      search,
      from,
      to,
      status,
    } = req.query as {
      page?: string | number;
      limit?: string | number;
      sort?: string | number;
      search?: string;
      from?: string;
      to?: string;
      status?: string;
    };

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    const sortNum = Number(sort) === 1 ? 1 : -1;

    const match: any = {
      fk_user_id: new ObjectId(user_id),
    };

    if (search?.trim()) {
      match.$or = [
        {
          company: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          title: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    if (from || to) {
      match.applied_on = {};

      if (from) {
        match.applied_on.$gte = new Date(from);
      }

      if (to) {
        match.applied_on.$lte = new Date(to);
      }
    }

    if (status) {
      const status_obj = status
        .split(",")
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      if (status_obj.length > 0) {
        match.status = {
          $in: status_obj,
        };
      }
    }

    const [docs, total] = await Promise.all([
      db
        .collection("trackers")
        .aggregate([
          {
            $match: match,
          },
          {
            $lookup: {
              from: "status",
              localField: "status",
              foreignField: "_id",
              pipeline: [
                {
                  $project: {
                    name: 1,
                    color: 1,
                  },
                },
              ],
              as: "status_result",
            },
          },
          {
            $unwind: {
              path: "$status_result",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              company: 1,
              image: 1,
              status_result: 1,
              status: 1,
              applied_on: 1,
              title: 1,
              site_name: 1,
              url: 1,
            },
          },
          {
            $sort: {
              applied_on: sortNum,
            },
          },
          {
            $skip: skip,
          },
          {
            $limit: limitNum,
          },
        ])
        .toArray(),

      db.collection("trackers").countDocuments(match),
    ]);

    return send_success(
      reply,
      {
        docs,
        total,
      },
      200,
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetTrackerbyID(req: FastifyRequest, reply: FastifyReply) {
  try {
    const db = get_db();
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { id } = req.query as {
      id: string;
    };

    if (!id || !ObjectId.isValid(id)) {
      return send_error(reply, "Job List not found", 404);
    }

    const doc = await db.collection("trackers").findOne(
      {
        fk_user_id: new ObjectId(user_id),
        _id: new ObjectId(id),
      },
      {
        projection: {
          fk_user_id: 0,
          updated_on: 0,
          applied_on: 0,
          image: 0,
        },
      },
    );

    return send_success(reply, doc, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetTrackerRemindersID(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { id } = req.query as {
      id: string;
    };

    if (!id || !ObjectId.isValid(id)) {
      return send_error(reply, "Job List not found", 404);
    }
    const db = get_db();
    const doc = await db.collection("reminders").findOne(
      {
        fk_user_id: new ObjectId(user_id),
        fk_tracker_id: new ObjectId(id),
      },
      {
        projection: {
          fk_user_id: 0,
          updated_on: 0,
        },
      },
    );

    return send_success(reply, doc, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function SaveTracker(req: FastifyRequest, reply: FastifyReply) {
  try {
    const db = get_db();
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const body = req.body;

    const validate = TrackerSaveSchema.safeParse(body);

    if (!validate.success) {
      const msg = validate.error.issues[0].message ?? "Invalid Data";
      return send_error(reply, msg);
    }

    const { _id, ...data } = validate.data;

    let status: string | ObjectId = data.status;

    if (status && ObjectId.isValid(status)) {
      status = new ObjectId(status);
    } else {
      status = "applied";
    }

    if (_id && ObjectId.isValid(_id)) {
      const update = await db.collection("trackers").updateOne(
        {
          fk_user_id: new ObjectId(user_id),
          _id: new ObjectId(_id),
        },
        {
          $set: {
            ...data,
            status,
            updated_on: new Date(),
          },
        },
      );

      if (!update || !update.acknowledged) {
        return send_error(reply, "Internal Server Error", 500);
      }

      if (update.matchedCount <= 0) {
        return send_error(reply, "No Job Tracker Found !", 404);
      }

      return send_success(reply, {}, 200, "Tracker Updated Successfully !");
    }

    const insert = await db.collection("trackers").insertOne({
      ...data,
      status,
      fk_user_id: new ObjectId(user_id),
      applied_on: new Date(),
      created_on: new Date(),
    });

    if (!insert || !insert.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }

    return send_success(reply, {}, 200, "Tracker Created Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function UpdateTrackerStatus(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const db = get_db();
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const body = req.body;

    const validate = JobUpdateStatusSchema.safeParse(body);

    if (!validate.success) {
      const msg = validate.error.issues[0].message ?? "Invalid Data";
      return send_error(reply, msg);
    }

    const { status_id, tracker_id } = validate.data;

    if (!ObjectId.isValid(tracker_id)) {
      return send_error(reply, "Invalid Payload !");
    }

    const update = await db.collection("trackers").updateOne(
      {
        fk_user_id: new ObjectId(user_id),
        _id: new ObjectId(tracker_id),
      },
      {
        $set: {
          status: ObjectId.isValid(status_id) ? new ObjectId(status_id) : null,
          updated_on: new Date(),
        },
      },
    );

    if (!update || !update.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }
    if (update.matchedCount <= 0) {
      return send_error(reply, "No Job Tracker Found !", 404);
    }

    if (update.modifiedCount <= 0) {
      return send_info(reply, "Failed to Updated !");
    }

    return send_success(reply, {}, 200, "Status Updated Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function SaveReminders(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const body = req.body;

    const validate = SaveReminderSchema.safeParse(body);

    if (!validate.success) {
      const msg = validate.error.issues[0].message ?? "Invalid Data";
      return send_error(reply, msg);
    }

    const { fk_tracker_id, note, date, time } = validate.data;

    if (!ObjectId.isValid(fk_tracker_id)) {
      return send_error(reply, "Invalid Payload !", 400);
    }

    const [hours, minutes] = time.split(":").map(Number);
    const reminder_at = new Date(date);
    reminder_at.setUTCHours(hours, minutes, 0, 0);

    const db = get_db();
    const insert = await db.collection("reminders").updateOne(
      {
        fk_user_id: new ObjectId(user_id),
        fk_tracker_id: new ObjectId(fk_tracker_id),
      },
      {
        $set: {
          note,
          date: new Date(date),
          time,
          reminder_at,
          updated_on: new Date(),
        },
        $setOnInsert: {
          fk_user_id: new ObjectId(user_id),
          fk_tracker_id: new ObjectId(fk_tracker_id),
        },
      },
      {
        upsert: true,
      },
    );

    if (!insert || !insert.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }
    return send_success(
      reply,
      { fk_tracker_id },
      200,
      "Reminders Saved Successfully !",
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function DeleteReminders(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const id = req.body as string;

    if (!id || !ObjectId.isValid(id)) {
      return send_error(reply, "Invalid Payload !");
    }

    const db = get_db();

    const delete_doc = await db.collection("reminders").deleteOne({
      fk_user_id: new ObjectId(user_id),
      fk_tracker_id: new ObjectId(id),
    });
    if (!delete_doc || !delete_doc.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }
    if (delete_doc.deletedCount <= 0) {
      return send_error(
        reply,
        "Reminder not found ,Could Already deleted",
        404,
      );
    }

    return send_success(reply, {}, 200, "Reminder Deleted Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
