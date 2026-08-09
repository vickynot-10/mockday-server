import { z } from "zod";
import {
  HTTP_METHODS,
  STATUS_CODES,
} from "../constants/project.constants";

export const MonitoringConfigSchema = z.object({
  label: z
    .string({ error: "Label is required" })
    .trim()
    .min(1, "Label cannot be empty"),

  url: z.string({ error: "URL is required" }).trim().url("Invalid URL"),

  method: z.enum(Object.values(HTTP_METHODS), {
    error: "Invalid HTTP method",
  }),

  interval: z
    .number({ error: "Interval is required" })
    .min(60, "Minimum 1 Minute for Interval")
    .max(86400, "Maximum 1 Day for interval"),

  timeout: z
    .number({ error: "Timeout is required" })
    .min(5, "Minimum 5 Seconds for timeout")
    .max(60, "Maximum 1 Minute for interval"),

  status_codes: z
    .array(
      z
        .number()
        .int("Status code must be a whole number")
        .min(100, "Invalid status code")
        .max(599, "Invalid status code"),
      {
        error: "At least one status code is required",
      },
    )
    .min(1, "At least one status code is required")
    .refine(
      (codes) => {
        const validCodes = Object.values(STATUS_CODES).flatMap((group) =>
          Object.keys(group).map(Number),
        );
        return codes.every((code) => validCodes.includes(code));
      },
      {
        message: "One or more status codes are invalid",
      },
    ),

  headers: z
    .array(
      z.object({
        key: z
          .string({ error: "Header key is required" })
          .trim()
          .min(1, "Header key cannot be empty"),
        value: z.string({ error: "Header value is required" }).trim(),
      }),
    )
    .optional(),

  body: z.string().optional(),

  send_as_json: z.boolean(),

  expected_response: z.string().optional(),
});

export const ProjectConfigSchema = z.object({
  _id: z.string().optional(),

  project_name: z
    .string({ error: "Project name is required" })
    .trim()
    .min(1, "Project name cannot be empty"),

  description: z.string().default(""),

  environment: z.enum(["production", "staging", "development", "testing"], {
    error: "Invalid environment",
  }),

  pinned: z.boolean({ error: "Pinned must be true or false" }),

  monitoring_urls: z.array(MonitoringConfigSchema).default([]),
});

export type ProjectConfigBody = z.infer<typeof ProjectConfigSchema>;
export type MonitoringConfigBody = z.infer<typeof MonitoringConfigSchema>;
