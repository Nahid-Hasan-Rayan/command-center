/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { z } from "zod";
import { FEATURES, type InvitableRole } from "@/domain/features";
import { MAX_STATE_CHARS, WIDGET_PERMISSIONS } from "@/domain/widgets";

export const emailSchema = z.string().trim().toLowerCase().min(3).max(254).pipe(z.email());

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use at most 128 characters.")
  .refine((value) => new Set(value).size >= 5, "Use a more varied password.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(60),
});

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code.");

export const uuidSchema = z.uuid();

export const featureSchema = z.enum(FEATURES);

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["viewer", "editor"] satisfies InvitableRole[]),
  features: z.array(featureSchema).max(FEATURES.length),
  days: z.coerce.number().int().min(1).max(30),
});

export const memberFeaturesSchema = z.object({
  userId: uuidSchema,
  features: z.array(featureSchema).max(FEATURES.length),
});

export const widgetStatusSchema = z.object({
  widgetId: uuidSchema,
  status: z.enum(["approved", "disabled", "pending"]),
  permissions: z.array(z.enum(WIDGET_PERMISSIONS)).max(WIDGET_PERMISSIONS.length),
});

export const widgetStateSchema = z
  .record(z.string().max(200), z.string())
  .refine(
    (value) =>
      Object.entries(value).reduce((sum, [key, item]) => sum + key.length + item.length, 0) <=
      MAX_STATE_CHARS,
    "State is too large.",
  );

export const frameMessageSchema = z.discriminatedUnion("type", [
  z.object({ cc: z.literal(1), token: z.string(), type: z.literal("ready") }),
  z.object({
    cc: z.literal(1),
    token: z.string(),
    type: z.literal("state.set"),
    data: widgetStateSchema,
  }),
  z.object({
    cc: z.literal(1),
    token: z.string(),
    type: z.literal("context.request"),
    id: z.number().int().positive(),
    scope: z.string().max(40),
  }),
]);

export type FrameMessage = z.infer<typeof frameMessageSchema>;
