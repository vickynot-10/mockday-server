import { z } from "zod";

export const StatusSchema = z.object({
  _id :z.string().optional(),
  name: z
    .string({ error: "Status Name is Required" })
    .min(1, { error: "Status is Required" }),
  color: z.string().optional(),
});
