import { send_success, send_error } from "../utils/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { get_db } from "../config/mongodb";
import { SendOTPschema, VerifyOTPschema } from "../schema/notification.schema";
import { sendOtpEmail } from "../service/mail.service";
export async function GetNotifications(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const db = get_db();
    const doc = await db.collection("notifications").findOne(
      {
        fk_user_id: new ObjectId(user_id),
      },
      {
        projection: {
          email: 1,
          push: 1,
          push_registered : 1,
          notify_email :1
        },
      },
    );

    return send_success(reply, doc, 200);
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function SaveNotifications(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { email, push , notify_email} = req.body as {
      email: boolean;
      push: boolean;
      notify_email : string;
    };

    const db = get_db();

    const result = await db.collection("notifications").updateOne(
      {
        fk_user_id: new ObjectId(user_id),
      },
      {
        $set: {
          email,
          push,
          notify_email,
          updated_on: new Date(),
        },
        $setOnInsert: {
          fk_user_id: new ObjectId(user_id),
          created_on: new Date(),
        },
      },
      {
        upsert: true,
      },
    );

    if (!result.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }

    return send_success(
      reply,
      {},
      200,
      "Notification settings saved successfully!",
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function RegisterDevice(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const { push_registered = false } = req.body as any;

    const db = get_db();

    const result = await db.collection("notifications").updateOne(
      {
        fk_user_id: new ObjectId(user_id),
      },
      {
        $set: {
          push_registered,
          updated_on: new Date(),
        },
        $setOnInsert: {
          fk_user_id: new ObjectId(user_id),
          created_on: new Date(),
        },
      },
      {
        upsert: true,
      },
    );

    if (!result.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }

    return send_success(
      reply,
      {},
      200,
      "Device Registered saved successfully!",
    );
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function SendOTP(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const body = req.body as any;
    const validate = SendOTPschema.safeParse(body);

    if (!validate.success) {
      return send_error(reply, validate.error.issues[0].message);
    }

    const { email } = validate.data;

    const db = get_db();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    const result = await db
      .collection("otp")
      .updateOne(
        { email, fk_user_id: new ObjectId(user_id) },
        { $set: { otp, expires_at } },
        { upsert: true },
      );

    if (!result.acknowledged) {
      return send_error(reply, "Internal Server Error", 500);
    }

    await sendOtpEmail(email, otp);

    return send_success(reply, {}, 200, "OTP sent successfully!");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}

export async function VerifyOTP(req: FastifyRequest, reply: FastifyReply) {
  try {
    const { user_id } = req.user;

    if (!user_id || !ObjectId.isValid(user_id)) {
      return send_error(reply, "Unauthorized", 401);
    }

    const body = req.body as any;
    const validate = VerifyOTPschema.safeParse(body);

    if (!validate.success) {
      return send_error(reply, validate.error.issues[0].message);
    }

    const { email, otp } = validate.data;

    const db = get_db();

    const record = await db.collection("otp").findOne({
      email,
      fk_user_id: new ObjectId(user_id),
      otp,
    });

    if (!record) {
      return send_error(reply, "Invalid OTP", 400);
    }

    if (record.expires_at < new Date()) {
      await db.collection("otp").deleteOne({ _id: record._id });
      return send_error(reply, "OTP has expired", 400);
    }

    await db.collection("otp").deleteOne({ _id: record._id });

    return send_success(reply, {}, 200, "Email verified successfully!");
  } catch (err) {
    return send_error(reply, "Internal Server Error", 500);
  }
}
