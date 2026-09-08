import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: 'example.env' });

import { Module, NestModule, MiddlewareConsumer, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppConfigModule } from './config/config.module';
import { SqlDbModule } from './database/sqldb.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    AppConfigModule,
    SqlDbModule,

    // Serve static frontend assets from public/
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      exclude: ['/messages*'],
    }),

    MessagesModule,
  ],
})
export class AppModule implements NestModule {
  private readonly logger = new Logger('HTTP');

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: Request, res: Response, next: NextFunction) => {
        const { method, originalUrl } = req;
        const start = Date.now();

        res.on('finish', () => {
          const { statusCode } = res;
          const duration = Date.now() - start;
          this.logger.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);
        });

        next();
      })
      .forRoutes('*'); // Captures every route, including 404s
  }
}
