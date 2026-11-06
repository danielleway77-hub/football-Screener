import { z } from "zod";

/** Shared by the login form and POST /api/auth/login. */
export const loginSchema = z.object({
  password: z.string().min(1, "Enter your password.").max(200, "That password is too long."),
});

export type LoginInput = z.infer<typeof loginSchema>;
