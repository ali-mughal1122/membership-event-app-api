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

  async sendContactUsEmail(email: string, name: string, message: string) {
    try {
      await this.mailerService.sendMail({
        to: 'admin@membershipapp.com',
        subject: `New Contact Inquiry from ${name}`,
        text: `You have received a new message from ${name} (${email}):\n\n${message}`,
        html: `<p>You have received a new message from <strong>${name}</strong> (${email}):</p>
               <p>${message}</p>`,
      });
      this.logger.log(`Contact email sent from ${email}`);
    } catch (error) {
      this.logger.error('Failed to send contact email:', error);
    }
  }

  async sendNewEventNotificationEmail(event: EventEmailDetails, memberEmails: string[]) {
    if (!memberEmails || memberEmails.length === 0) return;

    const eventUrl = this.buildEventUrl(event);
    const when = this.formatWhen(event.date, event.time);
    const location = event.location || 'TBA';

    for (const email of memberEmails) {
      try {
        await this.mailerService.sendMail({
          to: email,
          subject: `New Event Available: ${event.title}`,
          text: [
            `A new event is available: ${event.title}`,
            `Date/Time: ${when}`,
            `Location: ${location}`,
            `View and register: ${eventUrl}`,
          ].join('\n'),
          html: `
            <p>A new event is available and you are invited to register.</p>
            <p><strong>${this.escape(event.title)}</strong></p>
            <p>Date/Time: ${this.escape(when)}<br/>Location: ${this.escape(location)}</p>
            <p><a href="${eventUrl}">View Event / Register</a></p>
          `,
        });
      } catch (error) {
        this.logger.error(`Failed to send event notification to ${email}:`, error);
      }
    }
    this.logger.log(`Finished sending new event notifications to ${memberEmails.length} members.`);
  }

  async sendEventRegistrationEmail(memberEmail: string, event: EventEmailDetails, status = 'PENDING') {
    const eventUrl = this.buildEventUrl(event);
    const profileUrl = `${this.frontendUrl()}/profile`;
    const when = this.formatWhen(event.date, event.time);
    const location = event.location || 'TBA';

    try {
      await this.mailerService.sendMail({
        to: memberEmail,
        subject: `Registration Received: ${event.title}`,
        text: [
          `Your registration for ${event.title} has been received successfully and is currently pending admin approval.`,
          `Date/Time: ${when}`,
          `Location: ${location}`,
          `Status: ${status}`,
          `View event: ${eventUrl}`,
          `View profile: ${profileUrl}`,
        ].join('\n'),
        html: `
          <p>Your registration for <strong>${this.escape(event.title)}</strong> has been received successfully and is currently pending admin approval.</p>
          <p>Date/Time: ${this.escape(when)}<br/>Location: ${this.escape(location)}<br/>Status: ${this.escape(status)}</p>
          <p><a href="${eventUrl}">View Event</a> &nbsp;|&nbsp; <a href="${profileUrl}">View Profile</a></p>
        `,
      });
      this.logger.log(`Event registration email sent to ${memberEmail} for ${event.title}`);
    } catch (error) {
      this.logger.error(`Failed to send event registration email to ${memberEmail}:`, error);
    }
  }

  async sendRegistrationDecisionEmail(
    memberEmail: string,
    event: EventEmailDetails,
    status: 'APPROVED' | 'REJECTED',
  ) {
    const eventUrl = this.buildEventUrl(event);
    const approved = status === 'APPROVED';
    const when = this.formatWhen(event.date, event.time);
    const location = event.location || 'TBA';
    const profileUrl = `${this.frontendUrl()}/profile`;
    const subject = approved
      ? `Successfully Registered: ${event.title}`
      : `Registration Update: ${event.title}`;
    const summary = approved
      ? `You have been successfully registered for ${event.title}.`
      : `Your registration for ${event.title} has been rejected.`;

    try {
      await this.mailerService.sendMail({
        to: memberEmail,
        subject,
        text: [
          summary,
          `Date/Time: ${when}`,
          `Location: ${location}`,
          `Status: ${status}`,
          `View event: ${eventUrl}`,
          `View profile: ${profileUrl}`,
        ].join('\n'),
        html: `
          <p>${this.escape(summary)}</p>
          <p>Date/Time: ${this.escape(when)}<br/>Location: ${this.escape(location)}<br/>Status: <strong>${status}</strong></p>
          <p><a href="${eventUrl}">View Event</a> &nbsp;|&nbsp; <a href="${profileUrl}">View Profile</a></p>
        `,
      });
      this.logger.log(`Registration ${status} email sent to ${memberEmail} for ${event.title}`);
    } catch (error) {
      this.logger.error(`Failed to send registration ${status} email to ${memberEmail}:`, error);
    }
  }

  private frontendUrl() {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4300';
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
