import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: 'example.env' });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validate incoming request payloads according to DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

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
