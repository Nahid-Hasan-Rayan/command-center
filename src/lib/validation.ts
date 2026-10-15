/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { z } from "zod";
import { FEATURES, type InvitableRole } from "@/domain/features";
import { normalizeMatric, normalizeWhatsapp, REMOVAL_OPTIONS } from "@/domain/registration";
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

const whatsappSchema = z.string().transform((value, context) => {
  const normalized = normalizeWhatsapp(value);
  if (!normalized) {
    context.addIssue({
      code: "custom",
      message: "Enter a valid WhatsApp number with country code, for example +60 12-345 6789.",
    });
    return z.NEVER;
  }
  return normalized;
});

const optionalMatricSchema = z.string().transform((value, context) => {
  if (value.trim() === "") {
    return undefined;
  }
  const normalized = normalizeMatric(value);
  if (!normalized) {
    context.addIssue({
      code: "custom",
      message: "Matric ID can use letters, numbers and dashes, 4 to 20 characters.",
    });
    return z.NEVER;
  }
  return normalized;
});

const optionalNoteSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .transform((value) => (value === "" ? undefined : value));

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(60),
  whatsapp: whatsappSchema,
  matricId: optionalMatricSchema.optional(),
  note: optionalNoteSchema(500).optional(),
  acknowledged: z.literal("on", "Please confirm that you have read the notice."),
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

export const registrationDecisionSchema = z.object({
  userId: uuidSchema,
  decision: z.enum(["approve", "reject"]),
  note: optionalNoteSchema(500).optional(),
  features: z.array(featureSchema).max(FEATURES.length),
});

export const accountStatusSchema = z.object({
  userId: uuidSchema,
  status: z.enum(["approved", "suspended"]),
  note: optionalNoteSchema(500).optional(),
});

export const removalSchema = z
  .object({
    userId: uuidSchema,
    option: z.enum(REMOVAL_OPTIONS.map((option) => option.id) as [string, ...string[]], {
      message: "Choose what should happen to this account.",
    }),
    note: optionalNoteSchema(500).optional(),
    confirmEmail: z.string().trim().toLowerCase().max(254).optional(),
  })
  .refine((value) => value.option !== "delete" || Boolean(value.confirmEmail), {
    message: "Type the person's email address to confirm permanent deletion.",
    path: ["confirmEmail"],
  });

export const adminRoleSchema = z.object({
  userId: uuidSchema,
  makeAdmin: z.enum(["true", "false"]).transform((value) => value === "true"),
});
