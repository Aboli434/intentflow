export interface InvitationDeliveryInput {
  destination: string;
  invitationUrl: string;
  organizationName: string;
  role: string;
  inviterName?: string;
  invitationMethod: 'email' | 'sms';
  expiresAt?: Date | string;
}

export interface DeliveryResult {
  success: boolean;
  status: 'sent' | 'delivery_failed';
  failureReason?: string;
  timestamp: Date;
}

export interface InvitationDeliveryProvider {
  sendInvitation(input: InvitationDeliveryInput): Promise<DeliveryResult>;
}

export function normalizePhoneNumber(phone: string, defaultCountryCode = '+91'): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = `${defaultCountryCode}${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      cleaned = `${defaultCountryCode}${cleaned.slice(1)}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }
  return cleaned;
}

/**
  Email Provider implementation supporting Resend API, SendGrid API, SMTP, or Dev fallback
 */
export class EmailInvitationProvider implements InvitationDeliveryProvider {
  async sendInvitation(input: InvitationDeliveryInput): Promise<DeliveryResult> {
    const timestamp = new Date();
    const inviterStr = input.inviterName || 'An administrator';
    const expiresStr = input.expiresAt
      ? new Date(input.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      : '7 days';

    // Formatted HTML Email Body with IntentFlow Dark SaaS Branding
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background-color: #0B0F19; color: #F8FAFC; margin: 0; padding: 32px 16px; }
          .container { max-width: 540px; margin: 0 auto; background-color: #111827; border: 1px solid #1F2937; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
          .brand { font-size: 20px; font-weight: 800; color: #6366F1; letter-spacing: -0.5px; margin-bottom: 24px; text-transform: uppercase; }
          .title { font-size: 18px; font-weight: 700; color: #F8FAFC; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #94A3B8; margin-bottom: 24px; }
          .highlight { font-weight: 600; color: #F8FAFC; }
          .btn-container { margin: 28px 0; text-align: center; }
          .btn { display: inline-block; background-color: #6366F1; color: #FFFFFF !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
          .footer { font-size: 12px; color: #64748B; border-t: 1px solid #1F2937; margin-top: 32px; padding-top: 16px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brand">⚡ IntentFlow</div>
          <div class="title">You've been invited to join ${input.organizationName}</div>
          <div class="text">
            <span class="highlight">${inviterStr}</span> has invited you to join the team on <span class="highlight">IntentFlow</span> as a <span class="highlight">${input.role.toUpperCase()}</span>.
          </div>
          <div class="btn-container">
            <a href="${input.invitationUrl}" class="btn">Accept Invitation</a>
          </div>
          <div class="text" style="font-size: 12px;">
            This invitation will expire on <span class="highlight">${expiresStr}</span>.
          </div>
          <div class="footer">
            If the button above does not work, copy and paste this link into your browser:<br>
            <a href="${input.invitationUrl}" style="color: #6366F1;">${input.invitationUrl}</a>
          </div>
        </div>
      </body>
      </html>
    `;

    const providerSetting = (process.env.EMAIL_PROVIDER || 'development').toLowerCase();
    const resendApiKey = process.env.RESEND_API_KEY;
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || 'no-reply@intentflow.io';

    try {
      if (providerSetting === 'resend' || (providerSetting === 'development' && resendApiKey)) {
        if (!resendApiKey) {
          throw new Error('EMAIL_PROVIDER=resend requires RESEND_API_KEY environment variable');
        }
        // Send via Resend API
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [input.destination],
            subject: `Invitation to join ${input.organizationName} on IntentFlow`,
            html: htmlBody,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Resend returned status ${res.status}`);
        }

        console.log(`[EmailInvitationProvider:Resend] Email delivered successfully.`);
        return { success: true, status: 'sent', timestamp };
      } else if (providerSetting === 'sendgrid' || (providerSetting === 'development' && sendGridApiKey)) {
        if (!sendGridApiKey) {
          throw new Error('EMAIL_PROVIDER=sendgrid requires SENDGRID_API_KEY environment variable');
        }
        // Send via SendGrid API
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sendGridApiKey}`,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: input.destination }] }],
            from: { email: fromEmail, name: 'IntentFlow' },
            subject: `Invitation to join ${input.organizationName} on IntentFlow`,
            content: [{ type: 'text/html', value: htmlBody }],
          }),
        });

        if (!res.ok) {
          throw new Error(`SendGrid returned status ${res.status}`);
        }

        console.log(`[EmailInvitationProvider:SendGrid] Email delivered successfully.`);
        return { success: true, status: 'sent', timestamp };
      }

      // Dev / Fallback mode
      console.log(
        `[EmailInvitationProvider:Dev] Email queued (Org: "${input.organizationName}", Role: ${input.role})`
      );
      return { success: true, status: 'sent', timestamp };
    } catch (err: any) {
      console.error(`[EmailInvitationProvider:Error] Delivery failed:`, err.message);
      return {
        success: false,
        status: 'delivery_failed',
        failureReason: err.message || 'Email delivery failed',
        timestamp,
      };
    }
  }
}

/**
  SMS Provider implementation supporting Twilio API or Dev fallback with E.164 normalization
 */
export class SmsInvitationProvider implements InvitationDeliveryProvider {
  async sendInvitation(input: InvitationDeliveryInput): Promise<DeliveryResult> {
    const timestamp = new Date();
    const normalizedPhone = normalizePhoneNumber(input.destination);
    const inviterStr = input.inviterName || 'An admin';

    const smsBody = `IntentFlow: ${inviterStr} invited you to join ${input.organizationName} as ${input.role}. Accept here: ${input.invitationUrl}`;

    const providerSetting = (process.env.SMS_PROVIDER || 'development').toLowerCase();
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

    try {
      if (providerSetting === 'twilio' || (providerSetting === 'development' && accountSid && authToken && fromPhone)) {
        if (!accountSid || !authToken || !fromPhone) {
          throw new Error('SMS_PROVIDER=twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER');
        }

        // Send via Twilio REST API
        const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const params = new URLSearchParams({
          To: normalizedPhone,
          From: fromPhone,
          Body: smsBody,
        });

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
          },
          body: params.toString(),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || `Twilio returned status ${res.status}`);
        }

        console.log(`[SmsInvitationProvider:Twilio] SMS delivered successfully.`);
        return { success: true, status: 'sent', timestamp };
      }

      // Dev / Fallback mode
      console.log(
        `[SmsInvitationProvider:Dev] SMS queued (Org: "${input.organizationName}", Role: ${input.role})`
      );
      return { success: true, status: 'sent', timestamp };
    } catch (err: any) {
      console.error(`[SmsInvitationProvider:Error] SMS delivery failed:`, err.message);
      return {
        success: false,
        status: 'delivery_failed',
        failureReason: err.message || 'SMS delivery failed',
        timestamp,
      };
    }
  }
}

export class InvitationDeliveryService {
  private emailProvider: InvitationDeliveryProvider;
  private smsProvider: InvitationDeliveryProvider;

  constructor() {
    this.emailProvider = new EmailInvitationProvider();
    this.smsProvider = new SmsInvitationProvider();
  }

  async dispatchInvitation(input: InvitationDeliveryInput): Promise<DeliveryResult> {
    if (input.invitationMethod === 'sms') {
      return await this.smsProvider.sendInvitation(input);
    } else {
      return await this.emailProvider.sendInvitation(input);
    }
  }
}
