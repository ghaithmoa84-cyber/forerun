import { z } from 'zod';

export const SentryWebhookProjectSchema = z
  .object({
    id: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
  })
  .passthrough();

export type SentryWebhookProject = z.infer<typeof SentryWebhookProjectSchema>;

export const SentryWebhookIssueSchema = z
  .object({
    id: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    culprit: z.string().nullable().optional(),
    permalink: z.string().nullable().optional(),
    level: z.string().nullable().optional(),
    shortId: z.string().nullable().optional(),
    project: SentryWebhookProjectSchema.nullable().optional(),
  })
  .passthrough();

export type SentryWebhookIssue = z.infer<typeof SentryWebhookIssueSchema>;

export const SentryWebhookEventSchema = z
  .object({
    title: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
  })
  .passthrough();

export type SentryWebhookEvent = z.infer<typeof SentryWebhookEventSchema>;

export const SentryWebhookDataSchema = z
  .object({
    issue: SentryWebhookIssueSchema.nullable().optional(),
    description: z.string().nullable().optional(),
    event: SentryWebhookEventSchema.nullable().optional(),
  })
  .passthrough();

export type SentryWebhookData = z.infer<typeof SentryWebhookDataSchema>;

export const SentryWebhookPayloadSchema = z
  .object({
    action: z.string().nullable().optional(),
    project_name: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    level: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    web_url: z.string().nullable().optional(),
    culprit: z.string().nullable().optional(),
    issue: SentryWebhookIssueSchema.nullable().optional(),
    data: SentryWebhookDataSchema.nullable().optional(),
  })
  .passthrough();

export type SentryWebhookPayload = z.infer<typeof SentryWebhookPayloadSchema>;
