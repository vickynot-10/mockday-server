import { get_db } from "../config/mongodb";
import { send_success, send_error, send_info } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { StatusSchema } from "../schema/status.schema";
import { invalidateResumeCache, setCachedDefaultStatus } from "../cache/status.cache";

export async function GetStatus(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { search } = req.query as any;
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const db = get_db();

    const match: any = {
      fk_user_id: new ObjectId(user_id),
    };

    if (search) {
      match.name = {
        $regex: search,
        $options: "i",
      };
    }

    const data = await db
      .collection("status")
      .find(match, { projection: { fk_user_id: 0 } })
      .toArray();
    return send_success(reply, data, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function SaveStatus(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const body = req.body;

    const validate = StatusSchema.safeParse(body);

    if (!validate.success) {
      return send_error(reply, validate.error.issues[0].message);
    }

    const db = get_db();
    const now = new Date();
    const user_obj_id = new ObjectId(user_id);

    const { name, color, _id } = validate.data;
    if (_id && ObjectId.isValid(_id)) {
      const res = await db.collection("status").updateOne(
        {
          _id: new ObjectId(_id),
        },
        {
          $set: {
            updated_on: now,
            name,
            color,
          },
        },
      );

      if (!res || !res.acknowledged) {
        return send_error(reply, "Internal Server Error ", 500);
      }
      if (res.matchedCount <= 0) {
        return send_error(reply, "No Status found ", 400);
      }

      return send_success(reply, {}, 200, "Status Updated Successfully !");
    }

    const doc = {
      name,
      color,
      fk_user_id: user_obj_id,
      updated_on: now,
      created_on: now,
    };

    const result = await db.collection("status").insertOne(doc);
    if (!result || !result.acknowledged) {
      return send_error(reply, "Internal Server Error ", 500);
    }
    return send_success(reply, {}, 200, "Status Updated Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function DeleteStatus(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const ids = req.body as string[];

    if (!ids || ids.length <= 0) {
      return send_error(reply, "Invalid Payload ", 400);
    }

    const filter_ids: ObjectId[] = ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (filter_ids.length <= 0) {
      return send_error(reply, "Invalid Payload ", 400);
    }

    const db = get_db();

    const [delete_result] = await Promise.all([
      db.collection("status").deleteMany({
        _id: { $in: filter_ids },
        fk_user_id: new ObjectId(user_id),
      }),

      await invalidateResumeCache(user_id),
    ]);

    if (delete_result.deletedCount === 0) {
      return send_error(reply, "Nothing deleted", 404);
    }

    return send_success(reply, {}, 200, "Deleted Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function SetDefaultStatus(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }
    const { id } = req.body as any;

    if (!id || !ObjectId.isValid(id)) {
      return send_error(reply, "Invalid Status", 400);
    }
    const db = get_db();
    const obj_id = new ObjectId(id);
    const user_obj_id = new ObjectId(user_id);
    const [update, _, __] = await Promise.all([
      db.collection("status").updateOne(
        {
          _id: obj_id,
          fk_user_id: user_obj_id,
        },
        {
          $set: {
            default: true,
            updated_on: new Date(),
          },
        },
      ),
      db.collection("status").updateMany(
        {
          _id: {
            $ne: obj_id,
          },
          fk_user_id: user_obj_id,
        },
        {
          $set: {
            default: false,
          },
        },
      ),
      setCachedDefaultStatus(user_id , id),
    ]);

    if (!update || !update.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }

    if (update.matchedCount === 0) {
      return send_error(reply, "Nothing Updated", 404);
    }

    return send_success(reply, {}, 200, "Updated Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
