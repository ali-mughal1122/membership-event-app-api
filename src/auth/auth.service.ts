import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { MembersService } from '../members/members.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private membersService: MembersService,
  ) { }

  async onModuleInit() {
    const adminCount = await this.userRepository.count({ where: { email: 'admin@gmail.com' } });
    if (adminCount === 0) {
      const adminUser = this.userRepository.create({
        email: 'admin@gmail.com',
        password: await this.hashPassword('123123123'),
        type: 'ADMIN'
      });
      await this.userRepository.save(adminUser);
      console.log('Default admin user seeded into the database.');
    }
  }

  async login(user: LoginDto) {
    const dbUser = await this.userRepository.findOne({ where: { email: user.email } });

    if (!dbUser || !(await this.verifyPassword(user.password, dbUser.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.upgradePasswordIfNeeded(dbUser, user.password);

    const payload = { email: dbUser.email, sub: dbUser.id, type: dbUser.type };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(userDto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({ where: { email: userDto.email } });
    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    const newUser = this.userRepository.create({
      email: userDto.email,
      password: await this.hashPassword(userDto.password),
      name: userDto.name,
      phone: userDto.phone,
      address: userDto.address,
      type: 'USER',
    });

    const savedUser = await this.userRepository.save(newUser);
    const { password, ...safeUser } = savedUser;

    const payload = { email: savedUser.email, sub: savedUser.id, type: savedUser.type };
    return {
      access_token: this.jwtService.sign(payload),
      user: safeUser,
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
         if (!fs.existsSync(dir)){
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
