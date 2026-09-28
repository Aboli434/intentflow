import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from root .env if present
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/intentflow_db'),
  JWT_SECRET: z.string().default('intentflow_jwt_secret_key_production_2026'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  API_BASE_URL: z.string().default('http://localhost:4000'),

  // Email Integration
  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid', 'smtp', 'development']).default('development'),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('IntentFlow <no-reply@intentflow.io>'),

  // SMS Integration
  SMS_PROVIDER: z.enum(['twilio', 'development']).default('development'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Storage System
  STORAGE_PROVIDER: z.enum(['local', 's3', 'supabase']).default('local'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('intentflow-attachments'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;

export function validateProductionEnvStatus(customEnv?: Record<string, string | undefined>): void {
  const targetEnv = customEnv
    ? envSchema.parse({ ...process.env, ...customEnv })
    : env;

  if (targetEnv.NODE_ENV === 'test' && !customEnv) return;

  if (targetEnv.NODE_ENV === 'production') {
    if (targetEnv.EMAIL_PROVIDER === 'resend' && !targetEnv.RESEND_API_KEY) {
      throw new Error('Production Configuration Error: EMAIL_PROVIDER=resend requires RESEND_API_KEY');
    }
    if (targetEnv.EMAIL_PROVIDER === 'sendgrid' && !targetEnv.SENDGRID_API_KEY) {
      throw new Error('Production Configuration Error: EMAIL_PROVIDER=sendgrid requires SENDGRID_API_KEY');
    }
    if (targetEnv.EMAIL_PROVIDER === 'smtp' && (!targetEnv.SMTP_HOST || !targetEnv.SMTP_USER || !targetEnv.SMTP_PASSWORD)) {
      throw new Error('Production Configuration Error: EMAIL_PROVIDER=smtp requires SMTP_HOST, SMTP_USER, and SMTP_PASSWORD');
    }
    if (targetEnv.SMS_PROVIDER === 'twilio' && (!targetEnv.TWILIO_ACCOUNT_SID || !targetEnv.TWILIO_AUTH_TOKEN || !targetEnv.TWILIO_PHONE_NUMBER)) {
      throw new Error('Production Configuration Error: SMS_PROVIDER=twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER');
    }
    if (targetEnv.STORAGE_PROVIDER === 's3' && (!targetEnv.S3_BUCKET || !targetEnv.S3_ACCESS_KEY || !targetEnv.S3_SECRET_KEY)) {
      throw new Error('Production Configuration Error: STORAGE_PROVIDER=s3 requires S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY');
    }
    if (targetEnv.STORAGE_PROVIDER === 'supabase' && (!targetEnv.SUPABASE_URL || !targetEnv.SUPABASE_SERVICE_ROLE_KEY)) {
      throw new Error('Production Configuration Error: STORAGE_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
  }

  if (!customEnv) {
    console.log(`[Config] Environment initialized in ${targetEnv.NODE_ENV} mode.`);
    console.log(`[Config] Database: ${targetEnv.DATABASE_URL ? 'CONFIGURED' : 'UNCONFIGURED'}`);
    console.log(`[Config] Storage Provider: ${targetEnv.STORAGE_PROVIDER.toUpperCase()}`);
    console.log(`[Config] Email Provider: ${targetEnv.EMAIL_PROVIDER.toUpperCase()}`);
    console.log(`[Config] SMS Provider: ${targetEnv.SMS_PROVIDER.toUpperCase()}`);
    console.log(`[Config] CORS Origin: ${targetEnv.CORS_ORIGIN}`);
  }
}
