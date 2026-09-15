import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportConversation } from './entities/support-conversation.entity';
import { SupportMessage } from './entities/support-message.entity';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { CategoriesModule } from '../categories/categories.module';
import { MailModule } from '../mail/mail.module';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportConversation, SupportMessage, User]),
    CategoriesModule,
    MailModule,
  ],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
