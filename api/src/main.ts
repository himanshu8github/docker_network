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

  // Enable CORS for frontend clients (local dev & production custom domains)
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = [
        'https://cloudops.gradmetric.me',
        'https://gradmetric.me',
        'https://www.gradmetric.me',
        'https://logs.gradmetric.me',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
      ];
      if (
        allowed.includes(origin) ||
        origin.endsWith('.gradmetric.me') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'X-Origin-Secret',
      'x-user-email',
      'x-user-name',
      'x-journey-id',
      'x-reference-id',
      'x-device-id',
      'x-real-ip',
    ],
    exposedHeaders: ['x-journey-id', 'x-reference-id'],
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
