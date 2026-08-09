import { FastifyReply } from "fastify";

export const send_success = (
  reply: FastifyReply,
  data: any,
  code = 200,
  message?: string,
) => {
  return reply.code(code).send({ success: true, data, msg: message });
};

export const send_info = (reply: FastifyReply, message?: string) => {
  return reply.code(202).send({ info: true, msg: message });
};

export const send_error = (
  reply: FastifyReply,
  message: string,
  code = 400,
) => {
  return reply.code(code).send({ success: false, error: message });
};
