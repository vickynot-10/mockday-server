import { get_db } from "../config/mongodb";
import { send_success, send_error, send_info } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import {
  MAX_PINNED_PROJECTS,
  BULK_UPDATE_TYPES,
} from "../constants/project.constants";
import {
  ProjectConfigSchema,
  MonitoringConfigBody,
} from "../schema/project.schema";
import { Db, ObjectId } from "mongodb";

async function ReturnMonitotingURLS(
  db: Db,
  monitoring_urls: MonitoringConfigBody[],
  project_id: ObjectId,
  fk_org_id: ObjectId,
) {
  try {
    const monitoring_docs = monitoring_urls.map((item) => ({
      ...item,
      fk_project_id: project_id,
      fk_org_id: fk_org_id,
      updated_on: new Date(),
      created_on: new Date(),

      status: true,
    }));

    const save_urls = await db
      .collection("monitoring-urls")
      .insertMany(monitoring_docs);
    return Object.values(save_urls.insertedIds) || [];
  } catch (e) {
    throw e;
  }
}

export async function ProjectForm(req: FastifyRequest, reply: FastifyReply) {
  try {
    const validate = ProjectConfigSchema.safeParse(req.body);

    if (!validate.success) {
      return send_error(reply, validate.error.issues[0].message, 400);
    }

    const { data } = validate;

    const db = get_db();

    const { fk_org_id, user_id } = req.user;
    const fk_org_obj_id = new ObjectId(fk_org_id);

    const monitoring_urls = data.monitoring_urls || [];

    if (data._id && ObjectId.isValid(data._id)) {
      const id = new ObjectId(data._id);

      delete data._id;

      const [_, new_urls] = await Promise.all([
        db.collection("monitoring-urls").deleteMany({
          fk_project_id: id,
          fk_org_id: fk_org_obj_id,
        }),
        ReturnMonitotingURLS(db, monitoring_urls, id, fk_org_obj_id),
      ]);

      (data as any).monitoring_urls = new_urls;

      const update_doc = await db.collection("projects").updateOne(
        {
          _id: id,
          fk_org_id: fk_org_obj_id,
        },
        {
          $set: {
            ...data,
            updated_on: new Date(),
            updated_by: new ObjectId(user_id),
          },
        },
      );
      if (!update_doc.acknowledged) {
        return send_error(reply, "Internal Server Error", 500);
      }
      if (update_doc.modifiedCount <= 0) {
        return send_error(reply, "Failed to update", 400);
      }
      return send_success(reply, {}, 200, "Project Update Successfully !");
    }

    const project_id = new ObjectId();

    if (monitoring_urls && monitoring_urls.length > 0) {
      (data as any).monitoring_urls = await ReturnMonitotingURLS(
        db,
        monitoring_urls,
        project_id,
        fk_org_obj_id,
      );
    }

    const insert_doc = await db.collection("projects").insertOne({
      ...data,
      _id: project_id,
      fk_org_id: fk_org_obj_id,
      created_by: new ObjectId(user_id),
      updated_on: new Date(),
      created_on: new Date(),
      status: true,
    });

    if (!insert_doc.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }

    return send_success(reply, {}, 201, "Project created successfully");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetPinnedProjects(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const db = get_db();

    const { fk_org_id } = req.user;

    const data = await db
      .collection("projects")
      .find(
        {
          pinned: true,
          fk_org_id: new ObjectId(fk_org_id),
        },
        {
          projection: {
            project_name: 1,
            _id: 1,
            updated_on: 1,
            status: 1,
            urls_count: {
              $size: {
                $ifNull: ["$monitoring_urls", []],
              },
            },
          },
        },
      )
      .sort({ updated_on: -1 })
      .toArray();

    return send_success(reply, data, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetProjectsPagination(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const {
      search = "",
      page = "1",
      limit = "10",
    } = req.query as {
      search?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(Number(page), 1);
    const limitNum = Math.max(Number(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    const db = get_db();

    const { fk_org_id } = req.user;

    const match: any = {
      fk_org_id: new ObjectId(fk_org_id),
    };

    if (search && search.trim()) {
      match.project_name = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const [data, total] = await Promise.all([
      db
        .collection("projects")
        .find(match, {
          projection: {
            project_name: 1,
            description: 1,
            environment: 1,
            updated_on: 1,
            status: 1,
            urls_count: {
              $size: {
                $ifNull: ["$monitoring_urls", []],
              },
            },
            pinned: 1,
          },
        })
        .sort({ updated_on: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),

      db.collection("projects").countDocuments(match),
    ]);

    return send_success(
      reply,
      {
        data,
        total,
      },
      200,
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function GetProjectbyID(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = req.params as any;

    if (!id || !ObjectId.isValid(id)) {
      return send_error(reply, "Invalid Project", 400);
    }

    const db = get_db();

    const { fk_org_id } = req.user;

    const data = await db
      .collection("projects")
      .aggregate([
        {
          $match: {
            _id: new ObjectId(id),
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
                  fk_project_id: 0,
                  _id: 0,
                },
              },
            ],
            as: "result",
          },
        },
        {
          $addFields: {
            monitoring_urls: "$result",
          },
        },
        {
          $project: {
            created_on: 0,
            updated_on: 0,
            result: 0,
          },
        },
      ])
      .next();

    return send_success(reply, data, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function DeleteProjectbyID(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const id = req.body as any;

    if (!id || !ObjectId.isValid(id)) {
      return send_error(reply, "Invalid Project", 400);
    }

    const db = get_db();

    const { fk_org_id } = req.user;
    const fk_org_obj_id = new ObjectId(fk_org_id);

    await Promise.all([
      db.collection("projects").deleteOne({
        _id: new ObjectId(id),
        fk_org_id: fk_org_obj_id,
      }),
      db.collection("monitoring-urls").deleteMany({
        fk_project_id: new ObjectId(id),
        fk_org_id: fk_org_obj_id,
      }),
    ]);

    return send_success(reply, {}, 201, "Project Deleted Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function UpdatePorjectStatus(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { id, status } = req.body as any;

    if (!id || !ObjectId.isValid(id)) {
      return send_error(reply, "Invalid Project", 400);
    }

    const db = get_db();

    const { fk_org_id } = req.user;

    const update_doc = await db.collection("projects").updateOne(
      {
        _id: new ObjectId(id),
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
      {},
      201,
      "Project Status Updated Successfully !",
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function UnPinProject(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = req.body as any;

    if (!id || !ObjectId.isValid(id)) {
      return send_error(reply, "Invalid Project", 400);
    }

    const db = get_db();

    const { fk_org_id } = req.user;

    const update_doc = await db.collection("projects").updateOne(
      {
        _id: new ObjectId(id),
        fk_org_id: new ObjectId(fk_org_id),
      },
      {
        $set: {
          updated_on: new Date(),
          pinned: false,
        },
      },
    );
    if (!update_doc.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }
    if (update_doc.modifiedCount <= 0) {
      return send_error(reply, "Failed to update", 400);
    }

    return send_success(reply, {}, 201, "Project Unpinned Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function PinProject(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = req.body as any;

    if (!id || !ObjectId.isValid(id)) {
      return send_error(reply, "Invalid Project", 400);
    }

    const db = get_db();

    const { fk_org_id } = req.user;
    const fk_org_obj_id = new ObjectId(fk_org_id);

    const count = await db
      .collection("projects")
      .countDocuments({ pinned: true, fk_org_id: fk_org_obj_id });

    if (count >= MAX_PINNED_PROJECTS) {
      return send_info(
        reply,
        ` Maximum Pinned Projects as ${MAX_PINNED_PROJECTS} reached`,
      );
    }

    const update_doc = await db.collection("projects").updateOne(
      {
        _id: new ObjectId(id),
        fk_org_id: fk_org_obj_id,
      },
      {
        $set: {
          updated_on: new Date(),
          pinned: true,
        },
      },
    );
    if (!update_doc.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }
    if (update_doc.modifiedCount <= 0) {
      return send_error(reply, "Failed to update", 400);
    }

    return send_success(reply, {}, 201, "Project Pinned Successfully !");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function BulkUpdates(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { ids, type, status } = req.body as any;

    if (!ids || !Array.isArray(ids)) {
      return send_error(reply, "Invalid Projects", 400);
    }

    const filter_ids = ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (filter_ids.length <= 0) {
      return send_error(
        reply,
        "Atlease Choose 1 Project ID for bulk Operations",
        400,
      );
    }

    const num_type = Number(type) || 1;

    const db = get_db();

    const { fk_org_id } = req.user;
    const fk_org_obj_id = new ObjectId(fk_org_id);

    if (num_type === BULK_UPDATE_TYPES.STATUS) {
      // update status fields

      const result = await db.collection("projects").updateMany(
        {
          _id: { $in: filter_ids },
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
        `${result.modifiedCount} project(s) updated successfully`,
      );
    }

    if (num_type === BULK_UPDATE_TYPES.PIN) {
      const currentPinned = await db.collection("projects").countDocuments({
        pinned: true,
        fk_org_id: fk_org_obj_id,
      });

      const newPins = await db.collection("projects").countDocuments({
        _id: { $in: filter_ids },
        pinned: { $ne: true },
        fk_org_id: fk_org_obj_id,
      });

      if (currentPinned + newPins > MAX_PINNED_PROJECTS) {
        return send_info(
          reply,
          `Maximum ${MAX_PINNED_PROJECTS} pinned projects allowed.`,
        );
      }

      const result = await db.collection("projects").updateMany(
        {
          _id: { $in: filter_ids },
          pinned: false,
          fk_org_id: fk_org_obj_id,
        },
        {
          $set: {
            pinned: true,
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
        `${result.modifiedCount} project(s) pinned successfully`,
      );
    }

    if (num_type === BULK_UPDATE_TYPES.UNPIN) {
      const result = await db.collection("projects").updateMany(
        {
          _id: { $in: filter_ids },
          pinned: true,
          fk_org_id: fk_org_obj_id,
        },
        {
          $set: {
            pinned: false,
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
        `${result.modifiedCount} project(s) unpinned successfully`,
      );
    }

    if (num_type === BULK_UPDATE_TYPES.DELETE) {
      // delete projects fields and monitoring urls

      await Promise.all([
        db.collection("projects").deleteMany({
          _id: { $in: filter_ids },
          fk_org_id: fk_org_obj_id,
        }),
        db.collection("monitoring-urls").deleteMany({
          fk_project_id: { $in: filter_ids },
          fk_org_id: fk_org_obj_id,
        }),
      ]);

      return send_success(reply, {}, 200, "Projects deleted successfully");
    }

    return send_error(reply, "Invalid bulk operation !", 400);
  } catch (err) {
    console.log(err);
    return send_error(reply, "Internal Server Error", 500);
  }
}
