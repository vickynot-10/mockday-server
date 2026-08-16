import { z } from "zod";
export const JobUpdateStatusSchema = z.object({
  status_id: z
    .string({ error: "Status is Required" })
    .min(1, "Status is Required").nullable(),
  tracker_id: z
    .string({ error: "Status is Required" })
    .min(1, "Tracker is Required"),
});

export const TrackerSaveSchema = z.object({
  _id: z.string().optional(),
  company: z
    .string({ error: "Company is Required" })
    .min(1, "Company is Required"),
  title: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  page_title: z.string().optional(),
  h1: z.string().optional(),
  site_name: z.string().optional(),
  notes: z.array(z.string()).optional(),
  status: z.string().optional().nullable()
});
