import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  username: z.string().min(1, "Username is required").max(50),
  password: z.string().min(4, "Password must be at least 4 characters"),
  displayName: z.string().optional(),
  role: z.enum(["admin", "write", "viewer"]).default("viewer"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  displayName: z.string().optional(),
  role: z.enum(["admin", "write", "viewer"]).optional(),
  canRead: z.boolean().optional(),
  canWrite: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(4).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
