import { z } from "zod";
 
export const JobTrackerSchema = z.object({
  url: z.string().url(),
  pageTitle: z.string().optional(),
  ogTitle: z.string().optional(),
  ogSiteName: z.string().optional(),
  ogDescription: z.string().optional(),
  h1: z.string().optional(),
});