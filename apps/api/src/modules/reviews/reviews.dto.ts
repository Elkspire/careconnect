import {
  reportReviewSchema,
  submitReviewSchema,
} from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class SubmitReviewDto extends createZodDto(submitReviewSchema) {}
export class ReportReviewDto extends createZodDto(reportReviewSchema) {}
