import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Bypasses SupabaseAuthGuard for this route (e.g. public directory endpoints). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
