import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { AuthTokenType } from './entities/auth-token.entity';
import { AuthTokenService } from './auth-token.service';
import { MailService } from '../mail/mail.service';
import { MembersService } from '../members/members.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private membersService: MembersService,
    private authTokenService: AuthTokenService,
    private mailService: MailService,
  ) {}

  async onModuleInit() {
    const admin = await this.userRepository.findOne({ where: { email: 'admin@gmail.com' } });
    if (!admin) {
      const adminUser = this.userRepository.create({
        email: 'admin@gmail.com',
        password: await this.hashPassword('123123123'),
        type: 'ADMIN',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
      await this.userRepository.save(adminUser);
      this.logger.log('Default admin user seeded into database.');
    } else if (!admin.emailVerified) {
      admin.emailVerified = true;
      admin.emailVerifiedAt = new Date();
      await this.userRepository.save(admin);
    }
  }

  async login(user: LoginDto) {
    const email = user.email.trim().toLowerCase();
    const dbUser = await this.userRepository.findOne({ where: { email } });

    if (!dbUser || !(await this.verifyPassword(user.password, dbUser.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!dbUser.emailVerified) {
      throw new UnauthorizedException({
        message: 'Please verify your email address before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: dbUser.email,
      });
    }

    await this.upgradePasswordIfNeeded(dbUser, user.password);

    const payload = { email: dbUser.email, sub: dbUser.id, type: dbUser.type };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(userDto: RegisterDto) {
    const email = userDto.email.trim().toLowerCase();

    if (!this.isValidPassword(userDto.password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long, contain at least 1 uppercase letter, 1 lowercase letter, 1 number, 1 special character (@$!%*?&#^), and have no spaces.',
      );
    }

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const newUser = this.userRepository.create({
      email,
      password: await this.hashPassword(userDto.password),
      name: userDto.name?.trim(),
      phone: userDto.phone?.trim(),
      address: userDto.address?.trim(),
      type: 'USER',
      emailVerified: false,
      emailVerifiedAt: null,
    });

    const savedUser = await this.userRepository.save(newUser);

    // Generate 24-hour single-use email verification token
    const { rawToken } = await this.authTokenService.generateToken(
      savedUser.id,
      AuthTokenType.EMAIL_VERIFICATION,
      24,
    );

    // Send verification email
    this.mailService
      .sendEmailVerificationEmail(savedUser.email, savedUser.name, rawToken)
      .catch((err) => {
        this.logger.error(
          `Failed to dispatch verification email to ${savedUser.email}: ${err.message}`,
        );
      });

    return {
      success: true,
      message:
        'Registration successful! Please check your email to verify your account before logging in.',
      email: savedUser.email,
      emailVerified: false,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.authTokenService.verifyAndConsumeToken(
      token,
      AuthTokenType.EMAIL_VERIFICATION,
    );

    if (user.emailVerified) {
      return {
        success: true,
        alreadyVerified: true,
        message: 'Your email address has already been verified. You can sign in.',
      };
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Email verified successfully! You can now log in to your account.',
    };
  }

  async resendVerification(email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email: cleanEmail } });

    // Protect against account enumeration: return generic success if not found
    if (!user) {
      return {
        success: true,
        message: 'If an account exists with this email, a verification link has been sent.',
      };
    }

    if (user.emailVerified) {
      return {
        success: true,
        alreadyVerified: true,
        message: 'This email is already verified. You can log in directly.',
      };
    }

    const { rawToken } = await this.authTokenService.generateToken(
      user.id,
      AuthTokenType.EMAIL_VERIFICATION,
      24,
    );

    this.mailService
      .sendEmailVerificationEmail(user.email, user.name, rawToken)
      .catch((err) => {
        this.logger.error(
          `Failed to dispatch resend verification email to ${user.email}: ${err.message}`,
        );
      });

    return {
      success: true,
      message: 'A new verification link has been sent to your email address.',
    };
  }

  async forgotPassword(email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email: cleanEmail } });

    if (user) {
      try {
        const { rawToken } = await this.authTokenService.generateToken(
          user.id,
          AuthTokenType.PASSWORD_RESET,
          1, // 1 hour expiration
        );

        this.mailService
          .sendPasswordResetEmail(user.email, user.name, rawToken)
          .catch((err) => {
            this.logger.error(
              `Failed to dispatch password reset email to ${user.email}: ${err.message}`,
            );
          });
      } catch (error) {
        this.logger.warn(`Password reset rate limit or error for ${cleanEmail}: ${error.message}`);
      }
    }

    // Always return generic response to prevent account enumeration
    return {
      success: true,
      message:
        'If an account exists with this email, you will receive a password reset link shortly.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!this.isValidPassword(newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long, contain at least 1 uppercase letter, 1 lowercase letter, 1 number, 1 special character (@$!%*?&#^), and have no spaces.',
      );
    }

    const user = await this.authTokenService.verifyAndConsumeToken(
      token,
      AuthTokenType.PASSWORD_RESET,
    );

    user.password = await this.hashPassword(newPassword);
    // Completing password reset via email verifies the email address as well
    user.emailVerified = true;
    user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!(await this.verifyPassword(changePasswordDto.currentPassword, user.password))) {
      throw new UnauthorizedException('Invalid current password');
    }

    if (!this.isValidPassword(changePasswordDto.newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long, contain at least 1 uppercase letter, 1 lowercase letter, 1 number, 1 special character (@$!%*?&#^), and have no spaces.',
      );
    }

    user.password = await this.hashPassword(changePasswordDto.newPassword);
    await this.userRepository.save(user);

    return { message: 'Password changed successfully' };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    let profileImageBase64: string | null = null;
    if (user.profileImage) {
      try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(process.cwd(), 'uploads/profiles', user.profileImage);
        if (fs.existsSync(filePath)) {
          const fileData = fs.readFileSync(filePath);
          const ext = user.profileImage.split('.').pop() || 'png';
          profileImageBase64 = `data:image/${ext};base64,${fileData.toString('base64')}`;
        }
      } catch (err) {
        console.error('Failed to read profile image', err);
      }
    }

    const { password, ...safeUser } = user;
    const membership = await this.membersService.getMyMembership(userId);
    return { ...safeUser, profileImage: profileImageBase64, membership };
  }

  async updateProfile(userId: string, updateData: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (updateData.profileImage) {
      const matches = updateData.profileImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const ext = mimeType.split('/')[1] || 'png';
        const fileName = `profile-${userId}.${ext}`;

        const fs = require('fs');
        const path = require('path');
        const dir = path.join(process.cwd(), 'uploads/profiles');
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        user.profileImage = fileName;
      }
    }

    if (updateData.name !== undefined) user.name = updateData.name;
    if (updateData.phone !== undefined) user.phone = updateData.phone;
    if (updateData.address !== undefined) user.address = updateData.address;

    await this.userRepository.save(user);

    return this.getMe(userId);
  }

  private isValidPassword(password: string): boolean {
    if (!password || typeof password !== 'string') return false;
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]{8,}$/.test(
      password,
    );
  }

  private hashPassword(plain: string) {
    return bcrypt.hash(plain, 10);
  }

  private isBcryptHash(value: string) {
    return /^\$2[aby]\$/.test(value);
  }

  private async verifyPassword(plain: string, stored: string) {
    if (this.isBcryptHash(stored)) {
      return bcrypt.compare(plain, stored);
    }
    return stored === plain;
  }

  private async upgradePasswordIfNeeded(user: User, plain: string) {
    if (!this.isBcryptHash(user.password)) {
      user.password = await this.hashPassword(plain);
      await this.userRepository.save(user);
    }
  }
}
