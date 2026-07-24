// server/lib/schemas.js
import { z } from "zod";

export const signupSchema = z.object({
  name:     z.string().min(2).max(80).trim(),
  email:    z.string().email().toLowerCase(),
  password: z.string().min(6).max(128),
});

export const loginSchema = z.object({
  email:    z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const postSchema = z.object({
  title:   z.string().min(3).max(200).trim(),
  body:    z.string().min(10).max(5000).trim(),
  groupId: z.string().uuid().optional().nullable(),
  book:    z.string().optional(),
  chapter: z.number().int().positive().optional(),
  verse:   z.number().int().positive().optional(),
});

export const commentSchema = z.object({
  body:     z.string().min(1).max(2000).trim(),
  parentId: z.string().uuid().optional().nullable(),
});

export const marginNoteSchema = z.object({
  book:        z.string().min(1),
  chapter:     z.number().int().positive(),
  verse:       z.number().int().positive(),
  highlightId: z.string().uuid().optional().nullable(),
  body:        z.string().min(1).max(2000).trim(),
  parentId:    z.string().uuid().optional().nullable(),
  groupId:     z.string().uuid().optional().nullable(),
});

export const profileSchema = z.object({
  name:       z.string().min(2).max(80).trim().optional(),
  bio:        z.string().max(500).trim().optional(),
  avatar_url: z.string().url().max(500).optional().or(z.literal("")),
});

export const passwordResetSchema = z.object({
  token:    z.string().min(1),
  password: z.string().min(6).max(128),
});

// Middleware factory
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors.map(e => e.message).join(", ");
      return res.status(400).json({ error: message });
    }
    req.body = result.data;
    next();
  };
}
