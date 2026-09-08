import { Injectable } from '@nestjs/common';
import { configValidationSchema } from './config.schema';

@Injectable()
export class AppConfigService {
  private readonly envConfig: Record<string, any>;

  constructor() {
    // Validate process.env against Joi schema
    const { error, value } = configValidationSchema.validate(process.env, {
      abortEarly: false,
    });

    if (error) {
      const errorDetails = error.details.map((detail) => detail.message).join(', ');
      throw new Error(`[ConfigValidationError] Environment validation failed: ${errorDetails}`);
    }

    this.envConfig = value;
  }

  // --- Strongly Typed Getters ---

  get port(): number {
    return Number(this.envConfig.PORT);
  }

  get dbHost(): string {
    return String(this.envConfig.DB_HOST);
  }

  get dbPort(): number {
    return Number(this.envConfig.DB_PORT);
  }

  get dbUsername(): string {
    return String(this.envConfig.DB_USERNAME);
  }

  get dbPassword(): string {
    return String(this.envConfig.DB_PASSWORD);
  }

  get dbDatabase(): string {
    return String(this.envConfig.DB_DATABASE);
  }

  get nodeEnv(): string {
    return String(this.envConfig.NODE_ENV);
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  // Generic getter for any other environment variable
  get<T = any>(key: string, defaultValue?: T): T {
    return (this.envConfig[key] ?? defaultValue) as T;
  }
}
