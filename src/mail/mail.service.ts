import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

export interface EventEmailDetails {
  title: string;
  date?: Date | string | null;
  time?: string | null;
  location?: string | null;
  slug?: string | null;
  id?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  // 1. Contact Us Inquiry (Sent to Admin)
  async sendContactUsEmail(email: string, name: string, message: string) {
    const adminEmail = this.adminEmail();
    const html = this.wrapTemplate({
      title: 'New Contact Inquiry',
      salutation: `Hi <strong>Admin</strong>,`,
      leadText: `You have received a new message submitted via the taxiterminalen contact form:`,
      contentHtml: `
        <table width="100%" cellpadding="10" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; font-size: 14px;">
          <tr>
            <td style="color: #64748b; font-weight: 600; width: 25%; border-bottom: 1px solid #e2e8f0;">From:</td>
            <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${this.escape(name)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Email:</td>
            <td style="color: #2563eb; border-bottom: 1px solid #e2e8f0;">${this.escape(email)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; vertical-align: top;">Message:</td>
            <td style="color: #0f172a; line-height: 22px;">${this.escape(message)}</td>
          </tr>
        </table>
      `,
      button: {
        text: `Reply to ${name}`,
        url: `mailto:${encodeURIComponent(email)}?subject=Re: Inquiry from taxiterminalen`,
      },
      callout: `💬 You can reply directly to this sender by clicking the button above or emailing <strong>${this.escape(email)}</strong>.`,
      securityNote: 'This inquiry was sent from the public contact form on taxiterminalen.',
    });

    try {
      await this.mailerService.sendMail({
        to: adminEmail,
        subject: `New Contact Inquiry from ${name}`,
        text: `You have received a new message from ${name} (${email}):\n\n${message}`,
        html,
      });
      this.logger.log(`Contact email sent from ${email} to ${adminEmail}`);
    } catch (error) {
      this.logger.error('Failed to send contact email:', error);
    }
  }

  // 2. New Membership Subscription (Sent to Admin)
  async sendNewMembershipAdminNotificationEmail(details: {
    memberName: string;
    memberEmail: string;
    planName: string;
    planPrice?: number;
    durationMonths?: number;
    startDate?: Date | string;
    endDate?: Date | string;
  }) {
    const adminUrl = `${this.frontendUrl()}/admin/members`;
    const startFormatted = details.startDate ? this.formatDateOnly(details.startDate) : 'Immediately';
    const endFormatted = details.endDate ? this.formatDateOnly(details.endDate) : 'Active';
    const priceText = details.planPrice != null ? `${details.planPrice} DKK` : 'Free';
    const durationText = details.durationMonths ? `${details.durationMonths} month(s)` : 'Standard';

    const html = this.wrapTemplate({
      title: 'New Membership Purchased',
      salutation: `Hi <strong>Admin</strong>,`,
      leadText: `A user has just purchased a new membership subscription on <strong>taxiterminalen</strong>:`,
      contentHtml: `
        <table width="100%" cellpadding="10" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; font-size: 14px;">
          <tr>
            <td style="color: #64748b; font-weight: 600; width: 35%; border-bottom: 1px solid #e2e8f0;">Member Name:</td>
            <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${this.escape(details.memberName)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Member Email:</td>
            <td style="color: #2563eb; border-bottom: 1px solid #e2e8f0;">${this.escape(details.memberEmail)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Plan:</td>
            <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${this.escape(details.planName)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Price:</td>
            <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${priceText}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Duration:</td>
            <td style="color: #0f172a; border-bottom: 1px solid #e2e8f0;">${durationText}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Valid Period:</td>
            <td style="color: #0f172a;">${startFormatted} &ndash; ${endFormatted}</td>
          </tr>
        </table>
      `,
      button: {
        text: 'View Members in Admin',
        url: adminUrl,
      },
      callout: `✓ <strong>Active Subscription.</strong> The member has been activated and has full access to member events.`,
      securityNote: 'Automated administrative notification from taxiterminalen.',
    });

    try {
      await this.mailerService.sendMail({
        to: this.adminEmail(),
        subject: `New Membership Purchased: ${details.memberName} (${details.planName})`,
        text: [
          `New membership subscription received:`,
          `- Member: ${details.memberName} (${details.memberEmail})`,
          `- Plan: ${details.planName}`,
          `- Price: ${priceText}`,
          `- Duration: ${durationText}`,
          `- Period: ${startFormatted} to ${endFormatted}`,
          ``,
          `View in Admin Panel: ${adminUrl}`,
        ].join('\n'),
        html,
      });
      this.logger.log(`New membership notification sent to admin (${this.adminEmail()}) for member ${details.memberEmail}`);
    } catch (error) {
      this.logger.error('Failed to send new membership admin email:', error);
    }
  }

  // 3. Membership Purchase Confirmation (Sent to Member)
  async sendMembershipConfirmationEmail(details: {
    memberName: string;
    memberEmail: string;
    planName: string;
    planPrice?: number;
    durationMonths?: number;
    startDate?: Date | string;
    endDate?: Date | string;
  }) {
    const profileUrl = `${this.frontendUrl()}/profile`;
    const endFormatted = details.endDate ? this.formatDateOnly(details.endDate) : 'Active';
    const priceText = details.planPrice != null ? `${details.planPrice} DKK` : 'Free';

    const html = this.wrapTemplate({
      title: 'Membership Confirmed!',
      salutation: `Hi <strong>${this.escape(details.memberName)}</strong>,`,
      leadText: `Congratulations! Your subscription to <strong>${this.escape(details.planName)}</strong> is now active. You now have full access to member-only events, news, and community privileges.`,
      contentHtml: `
        <table width="100%" cellpadding="10" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; font-size: 14px;">
          <tr>
            <td style="color: #64748b; font-weight: 600; width: 35%; border-bottom: 1px solid #e2e8f0;">Plan:</td>
            <td style="color: #2563eb; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${this.escape(details.planName)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Price:</td>
            <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${priceText}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Valid Until:</td>
            <td style="color: #0f172a; font-weight: 700;">${endFormatted}</td>
          </tr>
        </table>
      `,
      button: {
        text: 'View My Membership',
        url: profileUrl,
      },
      callout: `🎉 <strong>Full Access Unlocked.</strong> You can now explore upcoming member events and register instantly.`,
      securityNote: 'Thank you for being part of the taxiterminalen community.',
    });

    try {
      await this.mailerService.sendMail({
        to: details.memberEmail,
        subject: `Membership Confirmed: Welcome to ${details.planName}!`,
        text: [
          `Hi ${details.memberName},`,
          ``,
          `Congratulations! Your subscription to ${details.planName} is now active.`,
          `- Plan: ${details.planName}`,
          `- Price: ${priceText}`,
          `- Valid until: ${endFormatted}`,
          ``,
          `View your profile: ${profileUrl}`,
        ].join('\n'),
        html,
      });
      this.logger.log(`Membership confirmation email sent to ${details.memberEmail}`);
    } catch (error) {
      this.logger.error('Failed to send membership confirmation email:', error);
    }
  }

  // 4. New Event Published Notification (Sent to Active Subscribed Members)
  async sendNewEventNotificationEmail(event: EventEmailDetails, memberEmails: string[]) {
    if (!memberEmails || memberEmails.length === 0) return;

    const eventUrl = this.buildEventUrl(event);
    const when = this.formatWhen(event.date, event.time);
    const location = event.location || 'TBA';
    const uniqueEmails = Array.from(new Set(memberEmails.filter(Boolean)));

    for (let i = 0; i < uniqueEmails.length; i++) {
      const email = uniqueEmails[i];
      const html = this.wrapTemplate({
        title: `New Event: ${event.title}`,
        salutation: `Hi <strong>Member</strong>,`,
        leadText: `A new member event has just been published on <strong>taxiterminalen</strong>. As an active subscriber, you are invited to register!`,
        contentHtml: `
          <table width="100%" cellpadding="10" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; font-size: 14px;">
            <tr>
              <td style="color: #64748b; font-weight: 600; width: 25%; border-bottom: 1px solid #e2e8f0;">📅 When:</td>
              <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${this.escape(when)}</td>
            </tr>
            <tr>
              <td style="color: #64748b; font-weight: 600;">📍 Location:</td>
              <td style="color: #0f172a; font-weight: 700;">${this.escape(location)}</td>
            </tr>
          </table>
        `,
        button: {
          text: 'View Event & Register',
          url: eventUrl,
        },
        callout: `🎟 <strong>Exclusive Member Access.</strong> Early registration is recommended as seats may be limited.`,
        securityNote: 'You received this invitation because you are an active member of taxiterminalen.',
      });

      try {
        await this.mailerService.sendMail({
          to: email,
          subject: `New Member Event: ${event.title}`,
          text: [
            `A new event has been published on taxiterminalen:`,
            ``,
            `${event.title}`,
            `Date & Time: ${when}`,
            `Location: ${location}`,
            ``,
            `View and register: ${eventUrl}`,
          ].join('\n'),
          html,
        });
      } catch (error) {
        this.logger.error(`Failed to send event notification to ${email}:`, error);
      }

      // 1.1s delay to comply with Mailtrap sandbox testing rate limits (1 email/sec)
      if (i < uniqueEmails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
    }
    this.logger.log(`Finished sending new event notifications to ${uniqueEmails.length} active members.`);
  }

  // 5. Event Registration Confirmation (Sent to Member)
  async sendEventRegistrationEmail(memberEmail: string, event: EventEmailDetails, status = 'REGISTERED') {
    const eventUrl = this.buildEventUrl(event);
    const profileUrl = `${this.frontendUrl()}/profile`;
    const when = this.formatWhen(event.date, event.time);
    const location = event.location || 'TBA';

    const html = this.wrapTemplate({
      title: 'Registration Confirmed!',
      salutation: `Hi <strong>Member</strong>,`,
      leadText: `You have successfully registered for <strong>${this.escape(event.title)}</strong>! Here are your event details:`,
      contentHtml: `
        <table width="100%" cellpadding="10" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; font-size: 14px;">
          <tr>
            <td style="color: #64748b; font-weight: 600; width: 30%; border-bottom: 1px solid #e2e8f0;">Event:</td>
            <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${this.escape(event.title)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">📅 When:</td>
            <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${this.escape(when)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">📍 Location:</td>
            <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${this.escape(location)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600;">Status:</td>
            <td style="color: #059669; font-weight: 700;">✓ ${this.escape(status)}</td>
          </tr>
        </table>
      `,
      button: {
        text: 'View Event Details',
        url: eventUrl,
      },
      callout: `✓ <strong>Spot Reserved.</strong> You can view all your upcoming registrations anytime from your profile.`,
      securityNote: 'Please keep this confirmation for your records.',
    });

    try {
      await this.mailerService.sendMail({
        to: memberEmail,
        subject: `Registration Confirmed: ${event.title}`,
        text: [
          `Your registration is confirmed!`,
          ``,
          `Event: ${event.title}`,
          `Date & Time: ${when}`,
          `Location: ${location}`,
          `Status: ${status}`,
          ``,
          `View event: ${eventUrl}`,
          `View profile: ${profileUrl}`,
        ].join('\n'),
        html,
      });
      this.logger.log(`Event registration email sent to ${memberEmail} for ${event.title}`);
    } catch (error) {
      this.logger.error(`Failed to send event registration email to ${memberEmail}:`, error);
    }
  }

  // 6. Support Request (Sent to Admin)
  async sendSupportRequestEmail(details: {
    memberName: string;
    memberEmail: string;
    subject: string;
    categoryName: string;
    message: string;
  }) {
    const inboxUrl = `${this.frontendUrl()}/admin/support`;

    const html = this.wrapTemplate({
      title: 'New Support Request',
      salutation: `Hi <strong>Admin</strong>,`,
      leadText: `A user has submitted a support inquiry on <strong>taxiterminalen</strong>:`,
      contentHtml: `
        <table width="100%" cellpadding="10" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; font-size: 14px;">
          <tr>
            <td style="color: #64748b; font-weight: 600; width: 30%; border-bottom: 1px solid #e2e8f0;">Member:</td>
            <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${this.escape(details.memberName)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Email:</td>
            <td style="color: #2563eb; border-bottom: 1px solid #e2e8f0;">${this.escape(details.memberEmail)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Category:</td>
            <td style="color: #0f172a; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${this.escape(details.categoryName)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Subject:</td>
            <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${this.escape(details.subject)}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-weight: 600; vertical-align: top;">Message:</td>
            <td style="color: #0f172a; line-height: 22px;">${this.escape(details.message)}</td>
          </tr>
        </table>
      `,
      button: {
        text: 'Open Support in Admin',
        url: inboxUrl,
      },
      callout: `💬 Please review and reply to this ticket directly in the admin dashboard.`,
      securityNote: 'Support notification generated automatically by taxiterminalen.',
    });

    try {
      await this.mailerService.sendMail({
        to: this.adminEmail(),
        subject: `New support request: ${details.subject}`,
        text: [
          `${details.memberName} (${details.memberEmail}) submitted a support request.`,
          `Category: ${details.categoryName}`,
          `Subject: ${details.subject}`,
          '',
          details.message,
          '',
          `Open in admin: ${inboxUrl}`,
        ].join('\n'),
        html,
      });
      this.logger.log(`Support request email sent for ${details.memberEmail}`);
    } catch (error) {
      this.logger.error('Failed to send support request email:', error);
    }
  }

  // 7. Support Reply (Sent to Member)
  async sendSupportReplyEmail(details: {
    memberEmail: string;
    memberName: string;
    subject: string;
    message: string;
    conversationId: string;
  }) {
    const threadUrl = `${this.frontendUrl()}/profile/support/${details.conversationId}`;

    const html = this.wrapTemplate({
      title: 'Reply to Your Support Request',
      salutation: `Hi <strong>${this.escape(details.memberName)}</strong>,`,
      leadText: `The admin team has replied to your support request regarding <strong>${this.escape(details.subject)}</strong>:`,
      contentHtml: `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; line-height: 24px; color: #1e293b;">
            "${this.escape(details.message)}"
          </p>
        </div>
      `,
      button: {
        text: 'View Conversation',
        url: threadUrl,
      },
      callout: `💬 You can reply directly in this conversation from your profile.`,
      securityNote: 'Thank you for contacting taxiterminalen support.',
    });

    try {
      await this.mailerService.sendMail({
        to: details.memberEmail,
        subject: `Reply to your support request: ${details.subject}`,
        text: [
          `Hi ${details.memberName},`,
          '',
          'The admin replied to your support request.',
          `Subject: ${details.subject}`,
          '',
          details.message,
          '',
          `View the conversation: ${threadUrl}`,
        ].join('\n'),
        html,
      });
      this.logger.log(`Support reply email sent to ${details.memberEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send support reply email to ${details.memberEmail}:`, error);
    }
  }

  // 8. Email Verification (Sent to New User)
  async sendEmailVerificationEmail(email: string, name: string, token: string) {
    const verificationUrl = `${this.frontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    const displayName = name ? this.escape(name) : 'there';
    this.logger.log(`Verification email prepared for ${email}: ${verificationUrl}`);

    const html = this.wrapTemplate({
      title: 'Verify Your Email Address',
      salutation: `Hi <strong>${displayName}</strong>,`,
      leadText: `Welcome to <strong>taxiterminalen</strong>! To complete your registration and keep your account secure, please verify your email address by clicking the button below.`,
      button: {
        text: 'Verify Email',
        url: verificationUrl,
      },
      callout: `⏱ <strong>Link expires in 24 hours.</strong> This link can only be used once.`,
      securityNote: 'Security Note: If you did not create an account on taxiterminalen, please disregard this email.',
    });

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Verify Your Email Address — taxiterminalen',
        text: [
          `Hi ${name || 'there'},`,
          '',
          'Welcome to taxiterminalen! Please verify your email address to complete your registration and activate your account.',
          '',
          `Verify your email: ${verificationUrl}`,
          '',
          'This link will expire in 24 hours.',
          'If you did not create an account on taxiterminalen, please ignore this email.',
        ].join('\n'),
        html,
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}:`, error);
    }
  }

  // 9. Password Reset (Sent to User Requesting Reset)
  async sendPasswordResetEmail(email: string, name: string, token: string) {
    const resetUrl = `${this.frontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const displayName = name ? this.escape(name) : 'there';
    this.logger.log(`Password reset email prepared for ${email}: ${resetUrl}`);

    const html = this.wrapTemplate({
      title: 'Reset Your Password',
      salutation: `Hi <strong>${displayName}</strong>,`,
      leadText: `We received a request to reset the password associated with your taxiterminalen account. Click the button below to choose a new password.`,
      button: {
        text: 'Reset Password',
        url: resetUrl,
      },
      callout: `⏱ <strong>Link expires in 60 minutes.</strong> This single-use link can only be used once.`,
      securityNote: 'Security Note: If you did not request a password reset, you can safely ignore this email. Your current password remains secure.',
    });

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Reset Your Password — taxiterminalen',
        text: [
          `Hi ${name || 'there'},`,
          '',
          'We received a request to reset your password for your taxiterminalen account.',
          '',
          `Reset your password: ${resetUrl}`,
          '',
          'This link will expire in 60 minutes and can only be used once.',
          'If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.',
        ].join('\n'),
        html,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
    }
  }

  // Shared Master Email Template matching the taxiterminalen design system
  private wrapTemplate(params: {
    title: string;
    salutation?: string;
    leadText?: string;
    contentHtml?: string;
    button?: { text: string; url: string };
    callout?: string;
    securityNote?: string;
  }): string {
    const buttonHtml = params.button
      ? `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 10px 0 32px;">
              <a href="${params.button.url}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">
                ${this.escape(params.button.text)}
              </a>
            </td>
          </tr>
        </table>
      `
      : '';

    const calloutHtml = params.callout
      ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 18px; border-radius: 0 10px 10px 0; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; line-height: 20px; color: #475569;">
            ${params.callout}
          </p>
        </div>
      `
      : '';

    const fallbackHtml = params.button
      ? `
        <p style="margin: 0 0 12px; font-size: 13px; color: #64748b;">
          If the button doesn't work, copy and paste this URL into your browser:
        </p>
        <p style="margin: 0; font-size: 12px; line-height: 18px; color: #2563eb; word-break: break-all;">
          <a href="${params.button.url}" style="color: #2563eb;">${params.button.url}</a>
        </p>
      `
      : '';

    const securityNote =
      params.securityNote ||
      'Security Note: This is an automated notification regarding your taxiterminalen account.';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.escape(params.title)}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f8; padding: 40px 16px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); overflow: hidden; border: 1px solid #e2e8f0;">
                <!-- Header -->
                <tr>
                  <td style="padding: 36px 40px 24px; text-align: center; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">taxiterminalen</h1>
                    <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px; font-weight: 500;">Membership & Event Platform</p>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 40px 32px;">
                    <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 28px;">
                      ${this.escape(params.title)}
                    </h2>
                    ${params.salutation ? `<p style="margin: 0 0 20px; font-size: 15px; line-height: 24px; color: #475569;">${params.salutation}</p>` : ''}
                    ${params.leadText ? `<p style="margin: 0 0 24px; font-size: 15px; line-height: 24px; color: #475569;">${params.leadText}</p>` : ''}
                    ${params.contentHtml || ''}
                    ${buttonHtml}
                    ${calloutHtml}
                    ${fallbackHtml}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">
                      ${securityNote}
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                      &copy; ${new Date().getFullYear()} taxiterminalen. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private adminEmail() {
    return this.configService.get<string>('ADMIN_EMAIL') || 'admin@gmail.com';
  }

  private frontendUrl() {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';
  }

  private buildEventUrl(event: EventEmailDetails) {
    const segment = this.slugSegment(event);
    return `${this.frontendUrl()}/events/${segment}`;
  }

  private slugSegment(event: EventEmailDetails) {
    const raw = (event.slug || '').replace(/^\/events\//, '').replace(/^\/+|\/+$/g, '');
    if (raw) return raw;
    const fromTitle = (event.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return fromTitle || event.id || '';
  }

  private formatDateOnly(date?: Date | string | null) {
    if (!date) return 'N/A';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return String(date);
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private formatWhen(date?: Date | string | null, time?: string | null) {
    if (!date && !time) return 'TBA';
    let dateStr = 'TBA';
    if (date) {
      const parsed = new Date(date);
      if (!Number.isNaN(parsed.getTime())) {
        dateStr = parsed.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    }
    return time ? `${dateStr} at ${time}` : dateStr;
  }

  private escape(value: string) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
