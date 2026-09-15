import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Plan } from '../plans/entities/plan.entity';
import { User } from '../auth/entities/user.entity';
import { Member } from '../members/entities/member.entity';
import { Event } from '../events/entities/event.entity';
import { EventRegistration } from '../events/entities/event-registration.entity';
import { Category } from '../categories/entities/category.entity';
import { SupportConversation } from '../support/entities/support-conversation.entity';
import { SupportMessage } from '../support/entities/support-message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Plan, User, Member, Event, EventRegistration, Category, SupportConversation, SupportMessage])],
  providers: [SeedService],
})
export class SeedModule {}
