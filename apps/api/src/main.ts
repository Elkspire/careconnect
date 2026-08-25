import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Validates every DTO built with createZodDto() against the same Zod
  // schema packages/validation exports — apps/web validates client-side
  // against the identical schema, so there is one source of truth per
  // input boundary (see packages/validation).
  app.useGlobalPipes(new ZodValidationPipe());
  // Almost all of apps/web's data fetching runs server-side (Server
  // Components/Actions calling this API directly, Node-to-Node — CORS never
  // applies there), which is why this was missing entirely until now. The
  // Web Push subscribe/unsubscribe calls in components/push-notifications.tsx
  // are the one exception: a Client Component fetching this API straight
  // from the browser, which the browser silently blocks without an explicit
  // CORS allow-list (confirmed: the preflight OPTIONS request 404s and every
  // response is missing Access-Control-Allow-Origin without this).
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
