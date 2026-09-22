import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: 'example.env' });

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust the first proxy hop (Nginx reverse proxy) so req.ip reflects real visitor IP
  app.set('trust proxy', 1);

  // Validate incoming request payloads according to DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Enable CORS for Next.js frontend (local dev & production custom domains)
  app.enableCors({
    origin: true, // Allow all origins in dev, or specific domain in production
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const configService = app.get(AppConfigService);
  const port = configService.port;

  // CRITICAL DOCKER REQUIREMENT:
  // Binding to '0.0.0.0' enables the application inside the container to accept
  // incoming connections from outside the container (port mappings and Docker network).
  // If we bound only to '127.0.0.1', only processes inside the same container could connect.
  await app.listen(port, '0.0.0.0');
  console.log(`Server listening on http://0.0.0.0:${port}`);
}
bootstrap();
