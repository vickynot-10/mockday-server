import { send_success, send_error, send_info } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";
import { JobUpdateStatusSchema } from "../schema/job_tracker.schema";
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
    } = req.query as {
      page?: string | number;
      limit?: string | number;
      sort?: string | number;
      search?: string;
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
              url :1
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

    if (!ObjectId.isValid(status_id) || !ObjectId.isValid(tracker_id)) {
      return send_error(reply, "Invalid Payload !");
    }

    const update = await db.collection("trackers").updateOne(
      {
        fk_user_id: new ObjectId(user_id),
        _id: new ObjectId(tracker_id),
      },
      {
        $set: {
          status: new ObjectId(status_id),
          updated_on: new Date(),
        },
      },
    );

    if(!update || !update.acknowledged){
      return send_error(reply , "Internal Server Error" , 500)
    }
    if(update.matchedCount <= 0){
      
      return send_error(reply , "No Job Tracker Found !" , 404)
    }

    if(update.modifiedCount <= 0){
      
      return send_info(reply , "Failed to Updated !")
    }

    return send_success(reply, {} , 200 , "Status Updated Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
