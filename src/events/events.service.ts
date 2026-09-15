import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, QueryFailedError, Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { EventRegistration, RegistrationStatus } from './entities/event-registration.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { MembersService } from '../members/members.service';
import { MailService } from '../mail/mail.service';
import { User } from '../auth/entities/user.entity';
import { PaginationQuery, parsePagination, paginated } from '../common/pagination';

const ACTIVE_REGISTRATION_STATUSES = [RegistrationStatus.REGISTERED];

@Injectable()
export class EventsService implements OnModuleInit {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    @InjectRepository(EventRegistration)
    private registrationsRepository: Repository<EventRegistration>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private membersService: MembersService,
    private mailService: MailService,
  ) {}

  async onModuleInit() {
    try {
      await this.registrationsRepository
        .createQueryBuilder()
        .update(EventRegistration)
        .set({ status: RegistrationStatus.REGISTERED })
        .where('status IN (:...statuses)', { statuses: ['PENDING', 'APPROVED'] })
        .execute();

      await this.registrationsRepository
        .createQueryBuilder()
        .update(EventRegistration)
        .set({ status: RegistrationStatus.CANCELLED })
        .where('status = :status', { status: 'REJECTED' })
        .execute();
    } catch (error) {
      this.logger.warn('Could not migrate event registration statuses:', error);
    }
  }

  async findAll(userId?: string, userType?: string, query: PaginationQuery = {}) {
    const includeDrafts = userType === 'ADMIN';
    const hasPagination = query.page !== undefined && query.page !== null && query.page !== '';

    if (!hasPagination) {
      const events = includeDrafts
        ? await this.eventsRepository.find({ order: { date: 'ASC' } })
        : await this.eventsRepository.find({ where: { status: 'Published' }, order: { date: 'ASC' } });
      return this.enrichEvents(events, userId);
    }

    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const qb = this.eventsRepository.createQueryBuilder('event').orderBy('event.date', 'ASC');

    if (!includeDrafts) {
      qb.andWhere('event.status = :published', { published: 'Published' });
    }
    if (query.status) {
      qb.andWhere('event.status = :status', { status: query.status });
    }
    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(event.title) LIKE :search OR LOWER(event.location) LIKE :search OR LOWER(COALESCE(event.slug, \'\')) LIKE :search)', { search });
    }

    const total = await qb.getCount();
    const events = await qb.skip(skip).take(limit).getMany();
    const data = await this.enrichEvents(events, userId);
    return paginated(data, total, page, limit);
  }

  async findBySlug(slugParam: string, userId?: string, userType?: string) {
    const event = await this.resolveBySlug(slugParam);
    if (!event) {
      return null;
    }
    if (event.status !== 'Published' && userType !== 'ADMIN') {
      return null;
    }
    const [enriched] = await this.enrichEvents([event], userId);
    return enriched;
  }

  async create(createEventDto: CreateEventDto): Promise<Event> {
    const newEvent = this.eventsRepository.create({
      ...createEventDto,
      membershipRequired: createEventDto.membershipRequired ?? true,
      registrationDeadline: createEventDto.registrationDeadline
        ? new Date(createEventDto.registrationDeadline)
        : null,
    });
    const savedEvent = await this.eventsRepository.save(newEvent);

    if (savedEvent.status === 'Published') {
      this.notifyIfNewlyPublished(savedEvent);
    }

    return savedEvent;
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event | null> {
    const existing = await this.eventsRepository.findOneBy({ id });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }

    const wasPublished = existing.status === 'Published';
    const nextStatus = updateEventDto.status ?? existing.status;

    const { registrationDeadline, membershipRequired, ...rest } = updateEventDto;
    await this.eventsRepository.update(id, {
      ...rest,
      ...(membershipRequired !== undefined ? { membershipRequired } : {}),
      ...(registrationDeadline !== undefined
        ? { registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null }
        : {}),
    });

    const updated = await this.eventsRepository.findOneBy({ id });
    if (updated && updated.status === 'Published' && !wasPublished && nextStatus === 'Published') {
      this.notifyIfNewlyPublished(updated);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.eventsRepository.delete(id);
  }

  async registerForEvent(eventId: string, userId: string): Promise<EventRegistration> {
    const event = await this.eventsRepository.findOneBy({ id: eventId });
    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Event not found',
        code: 'EVENT_NOT_FOUND',
      });
    }

    if (event.status !== 'Published') {
      throw this.error(HttpStatus.BAD_REQUEST, 'This event is not open for registration.', 'EVENT_NOT_PUBLISHED');
    }

    if (event.registrationDeadline && new Date(event.registrationDeadline).getTime() < Date.now()) {
      throw this.error(HttpStatus.BAD_REQUEST, 'The registration deadline has passed.', 'REGISTRATION_CLOSED');
    }

    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw this.error(HttpStatus.UNAUTHORIZED, 'User not found.', 'NOT_AUTHENTICATED');
    }

    const activeMembership = await this.membersService.getActiveMembershipForUser(userId);
    if (event.membershipRequired && !activeMembership) {
      throw this.error(
        HttpStatus.FORBIDDEN,
        'An active membership is required to register for this event.',
        'MEMBERSHIP_REQUIRED',
      );
    }

    const existingRegistration = await this.registrationsRepository.findOne({
      where: { eventId, userId },
    });

    if (existingRegistration && existingRegistration.status !== RegistrationStatus.CANCELLED) {
      throw this.error(HttpStatus.BAD_REQUEST, 'You are already registered for this event.', 'ALREADY_REGISTERED');
    }

    const name = activeMembership?.user?.name || user.name || user.email;
    const email = activeMembership?.user?.email || user.email;

    let savedRegistration: EventRegistration;
    try {
      if (existingRegistration?.status === RegistrationStatus.CANCELLED) {
        existingRegistration.status = RegistrationStatus.REGISTERED;
        existingRegistration.name = name;
        existingRegistration.email = email;
        savedRegistration = await this.registrationsRepository.save(existingRegistration);
      } else {
        const registration = this.registrationsRepository.create({
          userId,
          eventId,
          name,
          email,
          status: RegistrationStatus.REGISTERED,
        });
        savedRegistration = await this.registrationsRepository.save(registration);
      }
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw this.error(HttpStatus.BAD_REQUEST, 'You are already registered for this event.', 'ALREADY_REGISTERED');
      }
      throw err;
    }

    if (email) {
      this.mailService
        .sendEventRegistrationEmail(email, event, RegistrationStatus.REGISTERED)
        .catch(error => this.logger.error('Failed to send registration confirmation email:', error));
    }

    return savedRegistration;
  }

  async getEventRegistrations(eventId: string, query: PaginationQuery = {}) {
    const event = await this.eventsRepository.findOneBy({ id: eventId });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const where: { eventId: string; status?: string } = { eventId };
    if (query.status && Object.values(RegistrationStatus).includes(query.status as (typeof RegistrationStatus)[keyof typeof RegistrationStatus])) {
      where.status = query.status;
    }
    const [registrations, total] = await this.registrationsRepository.findAndCount({
      where,
      relations: { user: true },
      order: { timestamp: 'DESC' },
      skip,
      take: limit,
    });

    const userIds = registrations.map(reg => reg.userId).filter(Boolean);
    const members = await this.membersService.findByUserIds(userIds);
    const latestMemberByUser = new Map<string, (typeof members)[number]>();
    for (const member of members) {
      const memberUserId = member.user?.id;
      if (memberUserId && !latestMemberByUser.has(memberUserId)) {
        latestMemberByUser.set(memberUserId, member);
      }
    }

    const data = registrations.map(reg => ({
      id: reg.id,
      name: reg.name || reg.user?.name || '',
      email: reg.email || reg.user?.email || '',
      timestamp: reg.timestamp,
      status: reg.status,
      membershipStatus: this.membersService.getDisplayStatus(latestMemberByUser.get(reg.userId)),
    }));

    return paginated(data, total, page, limit);
  }

  async getRecentRegistrations(): Promise<any[]> {
    const registrations = await this.registrationsRepository.find({
      relations: { event: true },
      order: { timestamp: 'DESC' },
      take: 10,
    });

    return registrations.map(reg => ({
      id: reg.id,
      eventId: reg.eventId,
      name: reg.name,
      email: reg.email,
      eventName: reg.event?.title,
      timestamp: new Date(reg.timestamp).getTime(),
      status: reg.status,
    }));
  }

  private async enrichEvents(events: Event[], userId?: string) {
    if (!events.length) {
      return [];
    }

    const eventIds = events.map(event => event.id);
    const counts = await this.registrationsRepository
      .createQueryBuilder('r')
      .select('r.eventId', 'eventId')
      .addSelect('COUNT(*)', 'count')
      .where('r.eventId IN (:...eventIds)', { eventIds })
      .andWhere('r.status IN (:...statuses)', { statuses: ACTIVE_REGISTRATION_STATUSES })
      .groupBy('r.eventId')
      .getRawMany();

    const countMap = new Map(counts.map(row => [row.eventId, Number(row.count)]));

    let userRegs = new Map<string, EventRegistration>();
    let hasActiveMembership = false;
    if (userId) {
      const [regs, membership] = await Promise.all([
        this.registrationsRepository.find({ where: { userId } }),
        this.membersService.getActiveMembershipForUser(userId),
      ]);
      userRegs = new Map(regs.map(reg => [reg.eventId, reg]));
      hasActiveMembership = !!membership;
    }

    return events.map(event => {
      const registeredCount = countMap.get(event.id) || 0;
      return this.toPublicEvent(event, registeredCount, userRegs.get(event.id), hasActiveMembership, userId);
    });
  }

  private toPublicEvent(
    event: Event,
    registeredCount: number,
    userReg: EventRegistration | undefined,
    hasActiveMembership: boolean,
    userId?: string,
  ) {
    const isRegistered = userReg?.status === RegistrationStatus.REGISTERED;
    const registrationStatus = isRegistered ? userReg.status : null;

    let canRegister = false;
    let registrationDisabledReason: string | null = null;

    if (isRegistered) {
      registrationDisabledReason = 'ALREADY_REGISTERED';
    } else if (!userId) {
      registrationDisabledReason = 'NOT_AUTHENTICATED';
    } else if (event.status !== 'Published') {
      registrationDisabledReason = 'EVENT_NOT_PUBLISHED';
    } else if (event.registrationDeadline && new Date(event.registrationDeadline).getTime() < Date.now()) {
      registrationDisabledReason = 'REGISTRATION_CLOSED';
    } else if (event.membershipRequired && !hasActiveMembership) {
      registrationDisabledReason = 'MEMBERSHIP_REQUIRED';
    } else {
      canRegister = true;
    }

    const { registrants, publishedNotificationSentAt, ...safeEvent } = event as Event & {
      registrants?: EventRegistration[];
    };

    return {
      ...safeEvent,
      registeredCount,
      membershipRequired: event.membershipRequired !== false,
      isRegistered,
      registrationStatus,
      canRegister,
      registrationDisabledReason,
    };
  }

  private notifyIfNewlyPublished(event: Event) {
    this.eventsRepository
      .update({ id: event.id, publishedNotificationSentAt: IsNull() }, { publishedNotificationSentAt: new Date() })
      .then(result => {
        if (!result.affected) {
          return;
        }
        return this.membersService.findAllActiveNonExpiredWithUsers().then(activeMembers => {
          const memberEmails = activeMembers
            .map(member => member.user?.email)
            .filter((email): email is string => !!email);

          if (memberEmails.length === 0) {
            return;
          }

          return this.mailService.sendNewEventNotificationEmail(event, memberEmails);
        });
      })
      .catch(error => {
        this.logger.error('Failed to send published-event notifications:', error);
      });
  }

  private async resolveBySlug(slugParam: string) {
    const segment = slugParam.replace(/^\/events\//, '').replace(/^\/+|\/+$/g, '');
    const candidates = [slugParam, segment, `/events/${segment}`];

    let event = await this.eventsRepository.findOne({
      where: candidates.map(slug => ({ slug })),
    });

    if (event) {
      return event;
    }

    const events = await this.eventsRepository.find();
    return (
      events.find(item => this.slugSegment(item) === segment) || null
    );
  }

  private slugSegment(event: Event) {
    const raw = (event.slug || '').replace(/^\/events\//, '').replace(/^\/+|\/+$/g, '');
    if (raw) return raw;
    return (event.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private error(status: HttpStatus, message: string, code: string) {
    return new HttpException({ statusCode: status, message, code }, status);
  }

  private isUniqueViolation(err: unknown) {
    return err instanceof QueryFailedError && (err as any).driverError?.code === '23505';
  }
}
