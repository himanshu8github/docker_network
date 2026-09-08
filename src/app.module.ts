import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    // TypeORM MySQL Configuration
    // In local development: DB_HOST defaults to 'localhost'
    // In Docker development: DB_HOST is set to 'mysql' (the service name of the MySQL container).
    // Docker's embedded DNS server automatically resolves 'mysql' to the MySQL container's IP.
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_DATABASE || 'message_db',
      autoLoadEntities: true,
      synchronize: true, // OK for learning projects; automatically creates the messages table
    }),

    // Serve static frontend assets (HTML, CSS, JS) from the public/ folder
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      exclude: ['/messages*'],
    }),

    MessagesModule,
  ],
})
export class AppModule {}
