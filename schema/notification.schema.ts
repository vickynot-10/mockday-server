import { z } from "zod";
export const SendOTPschema = z.object({
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
});

export const VerifyOTPschema = z.object({
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address"),

  otp: z
    .string({ error: "OTP is required" })
    .regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
});