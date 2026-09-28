# IntentFlow Environment Variables Reference

This document provides a comprehensive reference of all environment variables across the **IntentFlow** monorepo.

---

## 1. API Server Environment Variables (`apps/api`)

| Variable | Type | Required in Production | Default | Description |
|---|---|---|---|---|
| `NODE_ENV` | String | Yes | `development` | Environment mode (`development`, `test`, `production`). |
| `PORT` | Number | No | `4000` | Port for Fastify HTTP server. |
| `HOST` | String | No | `0.0.0.0` | Host binding for server listening. |
| `DATABASE_URL` | String | Yes | `postgresql://...` | PostgreSQL connection string. |
| `JWT_SECRET` | String | Yes | - | Secret key used for signing session JWT tokens. |
| `CORS_ORIGIN` | String | Yes | `*` | Allowed CORS origin (e.g. `https://app.intentflow.io`). |
| `FRONTEND_URL` | String | Yes | `http://localhost:3000` | Base URL of web client used in invitation links. |
| `API_BASE_URL` | String | Yes | `http://localhost:4000` | Base URL of API service. |

### Email Gateway Configuration
| Variable | Type | Required in Production | Default | Description |
|---|---|---|---|---|
| `EMAIL_PROVIDER` | Enum | Yes | `development` | Email provider engine (`resend`, `sendgrid`, `smtp`, `development`). |
| `RESEND_API_KEY` | String | If `EMAIL_PROVIDER=resend` | - | Resend transactional API key. |
| `SENDGRID_API_KEY` | String | If `EMAIL_PROVIDER=sendgrid` | - | SendGrid v3 API key. |
| `SMTP_HOST` | String | If `EMAIL_PROVIDER=smtp` | - | SMTP server hostname. |
| `SMTP_PORT` | Number | If `EMAIL_PROVIDER=smtp` | `587` | SMTP server port. |
| `SMTP_USER` | String | If `EMAIL_PROVIDER=smtp` | - | SMTP authentication username. |
| `SMTP_PASSWORD` | String | If `EMAIL_PROVIDER=smtp` | - | SMTP authentication password. |
| `EMAIL_FROM` | String | Yes | `IntentFlow <no-reply@intentflow.io>` | Sender identity for transactional emails. |

### SMS Gateway Configuration
| Variable | Type | Required in Production | Default | Description |
|---|---|---|---|---|
| `SMS_PROVIDER` | Enum | Yes | `development` | SMS provider engine (`twilio`, `development`). |
| `TWILIO_ACCOUNT_SID` | String | If `SMS_PROVIDER=twilio` | - | Twilio Account SID. |
| `TWILIO_AUTH_TOKEN` | String | If `SMS_PROVIDER=twilio` | - | Twilio Auth Token. |
| `TWILIO_PHONE_NUMBER` | String | If `SMS_PROVIDER=twilio` | - | E.164 formatted Twilio sender phone number. |

### File Storage Gateway Configuration
| Variable | Type | Required in Production | Default | Description |
|---|---|---|---|---|
| `STORAGE_PROVIDER` | Enum | Yes | `local` | Storage provider engine (`local`, `s3`, `supabase`). |
| `S3_BUCKET` | String | If `STORAGE_PROVIDER=s3` | `intentflow-attachments` | AWS S3 or MinIO bucket name. |
| `S3_REGION` | String | If `STORAGE_PROVIDER=s3` | `us-east-1` | AWS S3 bucket region. |
| `S3_ACCESS_KEY` | String | If `STORAGE_PROVIDER=s3` | - | AWS IAM access key ID. |
| `S3_SECRET_KEY` | String | If `STORAGE_PROVIDER=s3` | - | AWS IAM secret access key. |
| `SUPABASE_URL` | String | If `STORAGE_PROVIDER=supabase` | - | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | String | If `STORAGE_PROVIDER=supabase` | - | Supabase service role secret key. |
| `SUPABASE_STORAGE_BUCKET` | String | If `STORAGE_PROVIDER=supabase` | `intentflow-attachments` | Supabase storage bucket name. |

---

## 2. Web Client Environment Variables (`apps/web`)

| Variable | Type | Required in Production | Default | Description |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | String | Yes | `http://localhost:4000` | HTTP API base URL for client requests. |
| `NEXT_PUBLIC_WS_URL` | String | Yes | `ws://localhost:4000` | WebSocket base URL for real-time messaging. |

---

## 3. Mobile Client Environment Variables (`apps/mobile`)

| Variable | Type | Required in Production | Default | Description |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | String | Yes | `http://localhost:4000` | Mobile REST API base URL. |
