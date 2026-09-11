import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
// Compiled output from `nest build`, not source — this file is bundled
// directly by Vercel's Node function builder (esbuild), which does not
// emit the `emitDecoratorMetadata` output NestJS's DI relies on. Importing
// already-compiled JS sidesteps that; see tsconfig.json's "api" exclude.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
import { AppModule } from '../dist/app.module';

const server = express();
let ready: Promise<void> | null = null;

function bootstrap(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const app = await NestFactory.create(
        AppModule,
        new ExpressAdapter(server),
      );
      app.useGlobalPipes(new ZodValidationPipe());
      app.enableCors({
        origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
        credentials: true,
      });
      await app.init();
    })();
  }
  return ready;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  await bootstrap();
  server(req, res);
}
