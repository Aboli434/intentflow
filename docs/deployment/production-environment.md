# IntentFlow — Production Environment Reference

## Configuration Security Principles
1. **Zero Secret Leakage**: No secret tokens, database credentials, or private keys are ever stored in version control.
2. **Fail Fast on Missing Config**: The API startup routine evaluates `validateProductionEnvStatus()` and immediately throws fatal errors if production fallbacks are detected.
3. **No Wildcards in Production**: Wildcard CORS (`*`) and development email/SMS/storage fallbacks are forbidden when `NODE_ENV=production`.

---

## 1. Web Application Environment Variables (Vercel)

| Variable | Required | Production Value / Format | Purpose |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | **YES** | `https://api.intentflow.io` | Destination URL for all REST client requests |
| `NEXT_PUBLIC_WS_URL` | No | `wss://api.intentflow.io/ws` | WebSocket endpoint for real-time notifications |

---

## 2. Fastify API Environment Variables (Render / Railway / Container)

### Core Runtime
| Variable | Required | Production Value / Format | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **YES** | `production` | Enforces production security checks |
| `PORT` | **YES** | `4000` (or platform `$PORT`) | Port on which the Fastify web server listens |
| `HOST` | **YES** | `0.0.0.0` | Bind host address for container networking |
| `CORS_ORIGIN` | **YES** | `https://intentflow.io` | Explicit allowed frontend origin (no wildcards) |
| `FRONTEND_URL` | **YES** | `https://intentflow.io` | Origin used in email/SMS invitation links |
| `API_BASE_URL` | **YES** | `https://api.intentflow.io` | Public base URL of the API |

### Database & Authentication
| Variable | Required | Production Value / Format | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **YES** | `postgresql://user:pass@host:5432/intentflow_prod` | Connection string to PostgreSQL instance |
| `JWT_SECRET` | **YES** | Minimum 32-character random string | Secret key for signing and verifying auth JWTs |

### Storage Subsystem (Select `s3` or `supabase`)
| Variable | Required | Production Value / Format | Purpose |
| :--- | :--- | :--- | :--- |
| `STORAGE_PROVIDER` | **YES** | `s3` or `supabase` | Object storage provider (never `local` in prod) |
| `S3_BUCKET` | If s3 | `intentflow-production-attachments` | AWS S3 bucket name |
| `S3_REGION` | If s3 | `us-east-1` | AWS region |
| `S3_ACCESS_KEY` | If s3 | AWS IAM Access Key ID | IAM credential with PutObject/GetObject permissions |
| `S3_SECRET_KEY` | If s3 | AWS IAM Secret Access Key | IAM credential secret |
| `SUPABASE_URL` | If supabase | `https://xyzcompany.supabase.co` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | If supabase | Supabase service_role JWT key | Admin key for Supabase Storage bucket access |
| `SUPABASE_STORAGE_BUCKET` | If supabase | `intentflow-attachments` | Storage bucket name in Supabase |

### Email Notifications (Select `resend`, `sendgrid`, or `smtp`)
| Variable | Required | Production Value / Format | Purpose |
| :--- | :--- | :--- | :--- |
| `EMAIL_PROVIDER` | **YES** | `resend`, `sendgrid`, or `smtp` | Mail dispatch provider (never `development` in prod)|
| `RESEND_API_KEY` | If resend | `re_123456789...` | API key from Resend dashboard |
| `SENDGRID_API_KEY`| If sendgrid| `SG.123456789...` | API key from Twilio SendGrid dashboard |
| `SMTP_HOST` | If smtp | `smtp.mailgun.org` | Outgoing SMTP server address |
| `SMTP_PORT` | If smtp | `587` | Outgoing SMTP port |
| `SMTP_USER` | If smtp | SMTP username | Authentication user |
| `SMTP_PASSWORD` | If smtp | SMTP password | Authentication password |
| `EMAIL_FROM` | **YES** | `IntentFlow <notifications@intentflow.io>` | Verified sender email address |

### SMS Notifications (Optional)
| Variable | Required | Production Value / Format | Purpose |
| :--- | :--- | :--- | :--- |
| `SMS_PROVIDER` | **YES** | `twilio` (or `development`) | SMS delivery driver |
| `TWILIO_ACCOUNT_SID` | If twilio | `AC123456789...` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | If twilio | Twilio Auth Token | Twilio Secret Token |
| `TWILIO_PHONE_NUMBER`| If twilio | `+1234567890` | Verified Twilio sender phone number |

### AI Integration
| Variable | Required | Production Value / Format | Purpose |
| :--- | :--- | :--- | :--- |
| `OPENAI_API_KEY` | Optional | `sk-proj-...` | OpenAI API key for GPT-4o intent extraction |
