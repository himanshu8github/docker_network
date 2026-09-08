import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: AppConfigService) {}

  /**
   * GET /config/info
   * Demonstrates injecting and reading ConfigService in a Controller.
   * NOTE: For security, never expose database passwords in HTTP responses.
   */
  @Get('info')
  getConfigInfo() {
    return {
      status: 'ok',
      environment: this.configService.nodeEnv,
      port: this.configService.port,
      database: {
        host: this.configService.dbHost,
        port: this.configService.dbPort,
        username: this.configService.dbUsername,
        database: this.configService.dbDatabase,
      },
    };
  }
}
