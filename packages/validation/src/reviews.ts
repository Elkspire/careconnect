import { z } from "zod";

export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

export const reportReviewSchema = z.object({
  reason: z.string().min(1).max(1000),
});
export type ReportReviewInput = z.infer<typeof reportReviewSchema>;
