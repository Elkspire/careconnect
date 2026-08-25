import { submitReviewSchema } from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class SubmitReviewDto extends createZodDto(submitReviewSchema) {}
