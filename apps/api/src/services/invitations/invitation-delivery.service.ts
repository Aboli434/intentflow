export interface InvitationDeliveryInput {
  destination: string;
  invitationUrl: string;
  organizationName: string;
  role: string;
  invitationMethod: 'email' | 'sms';
}

export interface InvitationDeliveryProvider {
  sendInvitation(input: InvitationDeliveryInput): Promise<void>;
}

export class EmailInvitationProvider implements InvitationDeliveryProvider {
  async sendInvitation(input: InvitationDeliveryInput): Promise<void> {
    // Pluggable provider stub (Resend / SMTP / SendGrid ready)
    // Logs queued destination without leaking sensitive tokens
    console.log(
      `[EmailInvitationProvider] Email delivery queued for ${input.destination} (Org: "${input.organizationName}", Role: ${input.role})`
    );
  }
}

export class SmsInvitationProvider implements InvitationDeliveryProvider {
  async sendInvitation(input: InvitationDeliveryInput): Promise<void> {
    // Pluggable provider stub (Twilio / WhatsApp / Firebase ready)
    // Logs queued destination without leaking sensitive tokens
    console.log(
      `[SmsInvitationProvider] SMS delivery queued for ${input.destination} (Org: "${input.organizationName}", Role: ${input.role})`
    );
  }
}

export class InvitationDeliveryService {
  private emailProvider: InvitationDeliveryProvider;
  private smsProvider: InvitationDeliveryProvider;

  constructor() {
    this.emailProvider = new EmailInvitationProvider();
    this.smsProvider = new SmsInvitationProvider();
  }

  async dispatchInvitation(input: InvitationDeliveryInput): Promise<void> {
    if (input.invitationMethod === 'sms') {
      await this.smsProvider.sendInvitation(input);
    } else {
      await this.emailProvider.sendInvitation(input);
    }
  }
}
