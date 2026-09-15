import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SupportConversation } from './entities/support-conversation.entity';
import { SupportMessage } from './entities/support-message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { PaginationQuery, paginated, parsePagination } from '../common/pagination';
import { CategoriesService } from '../categories/categories.service';
import { CATEGORY_URGENCY_VALUES, CategoryUrgency } from '../categories/category-urgency';
import { MailService } from '../mail/mail.service';
import { User } from '../auth/entities/user.entity';
import { SupportSenderType, SupportStatus, SUPPORT_STATUS_VALUES } from './support.constants';

export interface SupportListQuery extends PaginationQuery {
  categoryId?: string;
  urgency?: string;
}

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportConversation)
    private conversationsRepository: Repository<SupportConversation>,
    @InjectRepository(SupportMessage)
    private messagesRepository: Repository<SupportMessage>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private categoriesService: CategoriesService,
    private mailService: MailService,
  ) {}

  async createForMember(userId: string, dto: CreateConversationDto) {
    const category = await this.categoriesService.findOne(dto.categoryId);
    const user = await this.usersRepository.findOneBy({ id: userId });
    const subject = dto.subject.trim();
    const body = dto.message.trim();
    const now = new Date();

    const conversation = await this.conversationsRepository.save(
      this.conversationsRepository.create({
        userId,
        categoryId: category.id,
        subject,
        status: SupportStatus.OPEN,
        lastMessage: preview(body),
        lastMessageAt: now,
        lastSenderType: SupportSenderType.MEMBER,
        unreadForAdmin: true,
        unreadForMember: false,
      }),
    );

    await this.messagesRepository.save(
      this.messagesRepository.create({
        conversationId: conversation.id,
        senderType: SupportSenderType.MEMBER,
        senderId: userId,
        body,
        isRead: false,
      }),
    );

    void this.mailService.sendSupportRequestEmail({
      memberName: user?.name || user?.email || 'Member',
      memberEmail: user?.email || '',
      subject,
      categoryName: category.name,
      message: body,
    });

    return this.getForMember(userId, conversation.id);
  }

  async findMine(userId: string, query: SupportListQuery = {}) {
    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const qb = this.conversationsRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.category', 'category')
      .where('conversation.userId = :userId', { userId })
      .orderBy('conversation.unreadForMember', 'DESC')
      .addOrderBy('conversation.lastMessageAt', 'DESC');

    this.applyStatusFilter(qb, query.status);
    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(conversation.subject) LIKE :search OR LOWER(conversation.lastMessage) LIKE :search)',
        { search },
      );
    }

    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();
    return paginated(
      data.map((conversation) => this.toListItem(conversation, 'USER')),
      total,
      page,
      limit,
    );
  }

  async findAllForAdmin(query: SupportListQuery = {}) {
    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const qb = this.conversationsRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.category', 'category')
      .leftJoinAndSelect('conversation.user', 'user')
      .orderBy('category.urgencyRank', 'ASC')
      .addOrderBy('conversation.lastSenderType', 'DESC')
      .addOrderBy('conversation.lastMessageAt', 'ASC');

    this.applyStatusFilter(qb, query.status);

    if (query.categoryId) {
      qb.andWhere('conversation.categoryId = :categoryId', { categoryId: query.categoryId });
    }

    const urgency = String(query.urgency || '').toUpperCase();
    if (CATEGORY_URGENCY_VALUES.includes(urgency as CategoryUrgency)) {
      qb.andWhere('category.urgency = :urgency', { urgency });
    }

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(COALESCE(user.name, \'\')) LIKE :search OR LOWER(user.email) LIKE :search OR LOWER(conversation.subject) LIKE :search)',
        { search },
      );
    }

    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();
    return paginated(
      data.map((conversation) => this.toListItem(conversation, 'ADMIN')),
      total,
      page,
      limit,
    );
  }

  async getForMember(userId: string, id: string) {
    const conversation = await this.loadConversation(id, true);
    this.assertOwner(conversation, userId);
    await this.markRead(id, SupportSenderType.ADMIN);
    conversation.unreadForMember = false;
    await this.conversationsRepository.save(conversation);
    const messages = await this.loadMessages(id);
    return this.toDetail(conversation, messages, 'USER');
  }

  async getForAdmin(id: string) {
    const conversation = await this.loadConversation(id, true);
    await this.markRead(id, SupportSenderType.MEMBER);
    conversation.unreadForAdmin = false;
    await this.conversationsRepository.save(conversation);
    const messages = await this.loadMessages(id);
    return this.toDetail(conversation, messages, 'ADMIN');
  }

  async replyAsMember(userId: string, id: string, dto: CreateMessageDto) {
    const conversation = await this.loadConversation(id, true);
    this.assertOwner(conversation, userId);
    const body = dto.message.trim();
    await this.appendMessage(conversation, SupportSenderType.MEMBER, userId, body, {
      unreadForAdmin: true,
      unreadForMember: false,
      reopen: true,
    });
    return this.getForMember(userId, id);
  }

  async replyAsAdmin(adminUserId: string, id: string, dto: CreateMessageDto, actor: { email: string }) {
    const conversation = await this.loadConversation(id, true);
    const body = dto.message.trim();
    await this.appendMessage(conversation, SupportSenderType.ADMIN, adminUserId, body, {
      unreadForAdmin: false,
      unreadForMember: true,
      reopen: false,
    });

    void this.mailService.sendSupportReplyEmail({
      memberEmail: conversation.user.email,
      memberName: conversation.user.name || conversation.user.email,
      subject: conversation.subject,
      message: body,
      conversationId: conversation.id,
    });

    return this.getForAdmin(id);
  }

  async updateStatus(id: string, status: string) {
    if (!SUPPORT_STATUS_VALUES.includes(status as SupportStatus)) {
      throw new NotFoundException('Invalid status');
    }
    const conversation = await this.loadConversation(id, true);
    conversation.status = status;
    await this.conversationsRepository.save(conversation);
    const messages = await this.loadMessages(id);
    return this.toDetail(conversation, messages, 'ADMIN');
  }

  async unreadCount(userId: string, type: string) {
    if (type === 'ADMIN') {
      const count = await this.conversationsRepository.count({ where: { unreadForAdmin: true } });
      return { count };
    }
    const count = await this.conversationsRepository.count({
      where: { userId, unreadForMember: true },
    });
    return { count };
  }

  private applyStatusFilter(qb: SelectQueryBuilder<SupportConversation>, status?: string) {
    const normalized = String(status || '').toUpperCase();
    if (SUPPORT_STATUS_VALUES.includes(normalized as SupportStatus)) {
      qb.andWhere('conversation.status = :status', { status: normalized });
    }
  }

  private async loadConversation(id: string, withUser = false) {
    const conversation = await this.conversationsRepository.findOne({
      where: { id },
      relations: withUser ? { category: true, user: true } : { category: true },
    });
    if (!conversation) {
      throw new NotFoundException('Support request not found');
    }
    return conversation;
  }

  private async loadMessages(conversationId: string) {
    return this.messagesRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  private assertOwner(conversation: SupportConversation, userId: string) {
    if (conversation.userId !== userId) {
      throw new ForbiddenException('You can only access your own support conversations');
    }
  }

  private async markRead(conversationId: string, senderType: SupportSenderType) {
    await this.messagesRepository
      .createQueryBuilder()
      .update(SupportMessage)
      .set({ isRead: true })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('senderType = :senderType', { senderType })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();
  }

  private async appendMessage(
    conversation: SupportConversation,
    senderType: SupportSenderType,
    senderId: string,
    body: string,
    flags: { unreadForAdmin: boolean; unreadForMember: boolean; reopen: boolean },
  ) {
    const now = new Date();
    await this.messagesRepository.save(
      this.messagesRepository.create({
        conversationId: conversation.id,
        senderType,
        senderId,
        body,
        isRead: false,
      }),
    );

    conversation.lastMessage = preview(body);
    conversation.lastMessageAt = now;
    conversation.lastSenderType = senderType;
    conversation.unreadForAdmin = flags.unreadForAdmin;
    conversation.unreadForMember = flags.unreadForMember;
    if (flags.reopen || senderType === SupportSenderType.ADMIN) {
      conversation.status = SupportStatus.OPEN;
    }
    await this.conversationsRepository.save(conversation);
  }

  private toListItem(conversation: SupportConversation, viewer: 'USER' | 'ADMIN') {
    return {
      id: conversation.id,
      subject: conversation.subject,
      status: conversation.status,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      lastSenderType: conversation.lastSenderType,
      unread: viewer === 'ADMIN' ? conversation.unreadForAdmin : conversation.unreadForMember,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      category: conversation.category
        ? {
            id: conversation.category.id,
            name: conversation.category.name,
            urgency: conversation.category.urgency,
          }
        : null,
      member: conversation.user
        ? {
            id: conversation.user.id,
            name: conversation.user.name || conversation.user.email,
            email: conversation.user.email,
          }
        : undefined,
    };
  }

  private toDetail(conversation: SupportConversation, messages: SupportMessage[], viewer: 'USER' | 'ADMIN') {
    return {
      ...this.toListItem(conversation, viewer),
      messages: messages.map((message) => ({
        id: message.id,
        senderType: message.senderType,
        senderId: message.senderId,
        body: message.body,
        isRead: message.isRead,
        createdAt: message.createdAt,
      })),
    };
  }
}

function preview(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}
