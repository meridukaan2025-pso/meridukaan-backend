import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly defaultFrom: string | null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') || 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';
    this.defaultFrom = this.configService.get<string>('SMTP_FROM') || null;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
      this.logger.warn('SMTP not configured. Password reset links will be logged only.');
    }
  }

  async sendPasswordResetEmail(email: string, resetUrl: string) {
    if (!this.transporter) {
      this.logger.warn(`Password reset link for ${email}: ${resetUrl}`);
      return;
    }

    const from = this.defaultFrom || 'no-reply@meridukaan.com';
    const subject = 'Reset your password';
    const text = `You requested a password reset. Click the link to set a new password: ${resetUrl}`;
    const html = `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `;

    await this.transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
  }
}
