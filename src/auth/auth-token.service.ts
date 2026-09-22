import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import { AuthToken, AuthTokenType } from './entities/auth-token.entity';
import { User } from './entities/user.entity';

@Injectable()
export class AuthTokenService {
  private readonly logger = new Logger(AuthTokenService.name);
  private readonly RATE_LIMIT_SECONDS = 60; // 1 request per 60 seconds

  constructor(
    @InjectRepository(AuthToken)
    private readonly authTokenRepository: Repository<AuthToken>,
  ) {}

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async generateToken(
    userId: string,
    type: AuthTokenType,
    ttlHours: number,
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    // 1. Rate limiting check: check if a token of this type was created in the last 60 seconds
    const cooldownDate = new Date(Date.now() - this.RATE_LIMIT_SECONDS * 1000);
    const recentToken = await this.authTokenRepository.findOne({
      where: {
        userId,
        type,
        createdAt: MoreThan(cooldownDate),
      },
      order: { createdAt: 'DESC' },
    });

    if (recentToken) {
      const secondsLeft = Math.ceil(
        (recentToken.createdAt.getTime() + this.RATE_LIMIT_SECONDS * 1000 - Date.now()) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${secondsLeft > 0 ? secondsLeft : 1} second(s) before requesting another email.`,
      );
    }

    // 2. Invalidate any existing active/unused tokens of this type for this user
    await this.authTokenRepository.update(
      { userId, type, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    // 3. Generate cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    // 4. Calculate expiration
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    // 5. Store token hash in database
    const tokenRecord = this.authTokenRepository.create({
      userId,
      tokenHash,
      type,
      expiresAt,
    });

    await this.authTokenRepository.save(tokenRecord);
    this.logger.log(`Generated ${type} token for user ${userId} (expires in ${ttlHours}h)`);

    return { rawToken, expiresAt };
  }

  async verifyAndConsumeToken(
    rawToken: string,
    type: AuthTokenType,
  ): Promise<User> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException('Token is required.');
    }

    const tokenHash = this.hashToken(rawToken.trim());
    const tokenRecord = await this.authTokenRepository.findOne({
      where: { tokenHash, type },
      relations: { user: true },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid or unrecognized link.');
    }

    if (tokenRecord.usedAt) {
      throw new BadRequestException('This link has already been used.');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new BadRequestException(
        'This link has expired. Please request a new one.',
      );
    }

    // Mark token as used immediately (single-use)
    tokenRecord.usedAt = new Date();
    await this.authTokenRepository.save(tokenRecord);

    this.logger.log(`Consumed ${type} token for user ${tokenRecord.userId}`);
    return tokenRecord.user;
  }
}
