import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';

  @IsNumber()
  PORT: number = 3000;

  @IsString()
  CORS_ORIGIN: string = 'http://localhost:4200';

  @IsString()
  MONGODB_URI: string;

  @IsString()
  AUDIO_PROCESSOR_URL: string;

  /** Internal microservice that owns Meta (Facebook/Instagram) OAuth + page lookup. */
  @IsString()
  META_ADAPTER_URL: string;

  @IsString()
  @MinLength(16, {
    message: 'JWT_SECRET must be at least 16 characters long',
  })
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string = '1d';

  /** Base URL of the frontend app, used to build the reset-password link sent by email. */
  @IsString()
  FRONTEND_URL: string;

  /** How long a forgot-password reset token stays valid. */
  @IsNumber()
  RESET_PASSWORD_TOKEN_TTL_MINUTES: number = 30;

  /** SMTP transport used to send the forgot-password email. */
  @IsString()
  SMTP_HOST: string;

  @IsNumber()
  SMTP_PORT: number = 587;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsString()
  SMTP_FROM: string;

  /** Which embedding provider the knowledge base RAG pipeline uses. */
  @IsIn(['openai', 'vertex-ai'])
  EMBEDDING_PROVIDER: string = 'openai';

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  OPENAI_EMBEDDING_MODEL?: string;

  /** Chat model used for LLM-based knowledge base sales formatting (openai). */
  @IsOptional()
  @IsString()
  OPENAI_CHAT_MODEL?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLOUD_PROJECT?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLOUD_LOCATION?: string;

  @IsOptional()
  @IsString()
  VERTEX_AI_EMBEDDING_MODEL?: string;

  /** Chat model used for LLM-based knowledge base sales formatting (vertex-ai). */
  @IsOptional()
  @IsString()
  VERTEX_AI_CHAT_MODEL?: string;

  /** GCS bucket knowledge base files are stored in. */
  @IsString()
  GCS_BUCKET_NAME: string;

  /** Vector store for knowledge base embeddings. */
  @IsString()
  PINECONE_API_KEY: string;

  @IsString()
  PINECONE_INDEX: string;

  /**
   * Phone number search/purchase. Optional so the server boots without them;
   * the buy-number routes return 503 until the provider is configured.
   * US numbers come from Twilio, IN numbers from Exotel.
   */
  @IsOptional()
  @IsString()
  TWILIO_ACCOUNT_SID?: string;

  @IsOptional()
  @IsString()
  TWILIO_AUTH_TOKEN?: string;

  /** Inbound voice webhook set on purchased Twilio numbers; defaults to AUDIO_PROCESSOR_URL/twilio/voice. */
  @IsOptional()
  @IsString()
  TWILIO_VOICE_WEBHOOK_URL?: string;

  @IsOptional()
  @IsString()
  EXOTEL_API_KEY?: string;

  @IsOptional()
  @IsString()
  EXOTEL_API_TOKEN?: string;

  @IsOptional()
  @IsString()
  EXOTEL_ACCOUNT_SID?: string;

  /** api.exotel.com (Singapore, default) or api.in.exotel.com (Mumbai). */
  @IsOptional()
  @IsString()
  EXOTEL_API_HOST?: string;

  /** Flow URL (https://my.exotel.com/exoml/start/<flow_id>) set as VoiceUrl on purchased ExoPhones. */
  @IsOptional()
  @IsString()
  EXOTEL_VOICE_FLOW_URL?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }
  return validatedConfig;
}
