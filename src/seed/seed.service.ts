import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Plan } from '../plans/entities/plan.entity';
import { User } from '../auth/entities/user.entity';
import { Member } from '../members/entities/member.entity';
import { Event } from '../events/entities/event.entity';
import { EventRegistration, RegistrationStatus } from '../events/entities/event-registration.entity';
import { Category } from '../categories/entities/category.entity';
import { SupportConversation } from '../support/entities/support-conversation.entity';
import { SupportMessage } from '../support/entities/support-message.entity';
import { CATEGORY_URGENCY_RANK, CategoryUrgency } from '../categories/category-urgency';
import { SupportSenderType, SupportStatus } from '../support/support.constants';

const DEMO_PASSWORD = '123123123';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Plan) private plansRepository: Repository<Plan>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Member) private membersRepository: Repository<Member>,
    @InjectRepository(Event) private eventsRepository: Repository<Event>,
    @InjectRepository(EventRegistration) private registrationsRepository: Repository<EventRegistration>,
    @InjectRepository(Category) private categoriesRepository: Repository<Category>,
    @InjectRepository(SupportConversation) private conversationsRepository: Repository<SupportConversation>,
    @InjectRepository(SupportMessage) private messagesRepository: Repository<SupportMessage>,
  ) {}

  async onModuleInit() {
    try {
      const plans = await this.seedPlans();
      const users = await this.seedUsersAndMembers(plans);
      const events = await this.seedEvents();
      await this.seedRegistrations(users, events);
      const categories = await this.seedCategories();
      await this.seedSupport(users, categories);
      this.logger.log('Dummy plans, members, events, and support data are ready.');
    } catch (error) {
      this.logger.error('Failed to seed dummy data', error);
    }
  }

  private async seedPlans() {
    const definitions: Array<Partial<Plan>> = [
      {
        name: 'Chauffør',
        description: 'Monthly membership for taxi drivers. Access member events and association news.',
        price: 249,
        durationMonths: 1,
        features: [
          'Register for member events',
          'Monthly association newsletter',
          'Digital membership card',
        ],
      },
      {
        name: 'Chauffør Årskort',
        description: 'Annual driver membership with workshop access and priority registration.',
        price: 2490,
        durationMonths: 12,
        features: [
          'All Chauffør benefits',
          'Priority event registration',
          'Free workshops and training',
          'Discounted annual meeting',
        ],
      },
      {
        name: 'Vognmand',
        description: 'For owner-operators and small fleets. Includes driver seats and fleet resources.',
        price: 4990,
        durationMonths: 12,
        features: [
          'All Årskort benefits',
          'Fleet owner resources',
          'Invites to vognmand roundtables',
          'Priority support',
        ],
      },
    ];

    const saved: Record<string, Plan> = {};
    for (const def of definitions) {
      let plan = await this.plansRepository.findOne({ where: { name: def.name } });
      if (!plan) {
        plan = await this.plansRepository.save(this.plansRepository.create(def));
        this.logger.log(`Seeded plan: ${plan.name}`);
      }
      saved[plan.name] = plan;
    }
    return saved;
  }

  private async seedUsersAndMembers(plans: Record<string, Plan>) {
    const password = await bcrypt.hash(DEMO_PASSWORD, 10);
    const today = startOfDay(new Date());

    const people: Array<{
      email: string;
      name: string;
      phone: string;
      address: string;
      planName: string;
      status: string;
      startMonthsAgo: number;
      durationMonths: number;
    }> = [
      {
        email: 'lars.nielsen@example.com',
        name: 'Lars Nielsen',
        phone: '+45 20 11 22 33',
        address: 'Nørrebrogade 12, 2200 København N',
        planName: 'Chauffør Årskort',
        status: 'ACTIVE',
        startMonthsAgo: 3,
        durationMonths: 12,
      },
      {
        email: 'anne.pedersen@example.com',
        name: 'Anne Pedersen',
        phone: '+45 21 44 55 66',
        address: 'Vesterbrogade 88, 1620 København V',
        planName: 'Vognmand',
        status: 'ACTIVE',
        startMonthsAgo: 6,
        durationMonths: 12,
      },
      {
        email: 'mikkel.sorensen@example.com',
        name: 'Mikkel Sørensen',
        phone: '+45 22 33 44 55',
        address: 'Åboulevarden 21, 8000 Aarhus C',
        planName: 'Chauffør',
        status: 'ACTIVE',
        startMonthsAgo: 0,
        durationMonths: 1,
      },
      {
        email: 'fatima.hassan@example.com',
        name: 'Fatima Hassan',
        phone: '+45 30 12 34 56',
        address: 'Amagerbrogade 45, 2300 København S',
        planName: 'Chauffør Årskort',
        status: 'ACTIVE',
        startMonthsAgo: 8,
        durationMonths: 12,
      },
      {
        email: 'jonas.holm@example.com',
        name: 'Jonas Holm',
        phone: '+45 28 77 88 99',
        address: 'Algade 7, 4000 Roskilde',
        planName: 'Chauffør Årskort',
        status: 'ACTIVE',
        startMonthsAgo: 14,
        durationMonths: 12,
      },
      {
        email: 'sofie.andersen@example.com',
        name: 'Sofie Andersen',
        phone: '+45 26 55 44 33',
        address: 'Østerbrogade 140, 2100 København Ø',
        planName: 'Chauffør',
        status: 'PENDING',
        startMonthsAgo: 0,
        durationMonths: 1,
      },
      {
        email: 'henrik.moller@example.com',
        name: 'Henrik Møller',
        phone: '+45 23 98 76 54',
        address: 'Banegårdspladsen 2, 8000 Aarhus C',
        planName: 'Vognmand',
        status: 'PENDING',
        startMonthsAgo: 0,
        durationMonths: 12,
      },
    ];

    const users: User[] = [];
    for (const person of people) {
      let user = await this.usersRepository.findOne({ where: { email: person.email } });
      if (!user) {
        user = await this.usersRepository.save(
          this.usersRepository.create({
            email: person.email,
            password,
            name: person.name,
            phone: person.phone,
            address: person.address,
            type: 'USER',
          }),
        );
        this.logger.log(`Seeded user: ${user.email}`);
      }
      users.push(user);

      const existingMember = await this.membersRepository.findOne({
        where: { user: { id: user.id } },
      });
      if (existingMember) {
        continue;
      }

      const plan = plans[person.planName];
      if (!plan) {
        continue;
      }

      const startDate = addMonths(today, -person.startMonthsAgo);
      const endDate = addMonths(startDate, person.durationMonths);

      await this.membersRepository.save(
        this.membersRepository.create({
          user,
          plan,
          startDate,
          endDate,
          status: person.status,
        }),
      );
      this.logger.log(`Seeded membership for ${user.email} (${person.status})`);
    }

    return users;
  }

  private async seedEvents() {
    const definitions = [
      {
        title: 'Årsmøde 2026',
        slug: '/events/aarsmoede-2026',
        description:
          'Annual general meeting for Taxiterminalen members. Board report, elections, and networking dinner.',
        date: new Date('2026-10-10T09:00:00'),
        time: '09:00',
        location: 'Tivoli Congress Center, København',
        status: 'Published',
        membershipRequired: true,
        registrationDeadline: new Date('2026-10-08T23:59:59'),
        banner: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80',
        agenda: [
          { time: '09:00', title: 'Registration and coffee', description: 'Check in and member networking.' },
          { time: '10:00', title: 'Board report', description: 'Year in review and finances.' },
          { time: '12:00', title: 'Lunch', description: 'Served in the foyer.' },
          { time: '13:30', title: 'Elections', description: 'Board and committee elections.' },
        ],
      },
      {
        title: 'EV Transition Workshop',
        slug: '/events/ev-transition-workshop',
        description:
          'Practical workshop on charging, range, and total cost when switching a taxi to electric.',
        date: new Date('2026-11-05T13:00:00'),
        time: '13:00',
        location: 'DOKK1, Aarhus',
        status: 'Published',
        membershipRequired: true,
        registrationDeadline: new Date('2026-11-02T23:59:59'),
        banner: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1600&q=80',
        agenda: [
          { time: '13:00', title: 'Welcome', description: 'Overview of EV adoption in Danish taxi fleets.' },
          { time: '13:30', title: 'Charging infrastructure', description: 'City and depot charging options.' },
          { time: '15:00', title: 'Q&A', description: 'Open discussion with operators already on EV.' },
        ],
      },
      {
        title: 'Open Taxi Meetup',
        slug: '/events/open-taxi-meetup',
        description:
          'Open evening for drivers, students, and partners. No membership required.',
        date: new Date('2026-10-22T18:00:00'),
        time: '18:00',
        location: 'Taxiterminalen Lounge, København',
        status: 'Published',
        membershipRequired: false,
        registrationDeadline: new Date('2026-10-21T23:59:59'),
        banner: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1600&q=80',
        agenda: [
          { time: '18:00', title: 'Doors open', description: 'Drinks and introductions.' },
          { time: '18:30', title: 'Industry talk', description: 'Short updates from the association.' },
          { time: '19:15', title: 'Networking', description: 'Meet other drivers and partners.' },
        ],
      },
      {
        title: 'Winter Driving Safety',
        slug: '/events/winter-driving-safety',
        description:
          'Seasonal briefing on winter tyres, black ice, and night shifts in Greater Copenhagen.',
        date: new Date('2026-12-03T10:00:00'),
        time: '10:00',
        location: 'Scandic Sydhavnen, København',
        status: 'Published',
        membershipRequired: true,
        registrationDeadline: new Date('2026-11-30T23:59:59'),
        banner: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1600&q=80',
        agenda: [
          { time: '10:00', title: 'Safety briefing', description: 'Winter conditions and vehicle prep.' },
          { time: '11:30', title: 'Practical tips', description: 'Shift planning and passenger communication.' },
        ],
      },
      {
        title: 'Summer Kickoff 2026',
        slug: '/events/summer-kickoff-2026',
        description:
          'Past season opener with member awards and a city-drive briefing.',
        date: new Date('2026-08-28T17:00:00'),
        time: '17:00',
        location: 'Ofelia Plads, København',
        status: 'Published',
        membershipRequired: true,
        registrationDeadline: new Date('2026-08-26T23:59:59'),
        banner: 'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?auto=format&fit=crop&w=1600&q=80',
        agenda: [
          { time: '17:00', title: 'Awards', description: 'Member of the year and fleet awards.' },
          { time: '18:00', title: 'Reception', description: 'Food and drinks on the waterfront.' },
        ],
      },
      {
        title: 'Q1 2027 Planning',
        slug: '/events/q1-2027-planning',
        description: 'Internal planning session. Draft — not visible on the public calendar yet.',
        date: new Date('2027-01-14T09:00:00'),
        time: '09:00',
        location: 'Taxiterminalen Office, København',
        status: 'Draft',
        membershipRequired: true,
        registrationDeadline: null,
        banner: 'https://images.unsplash.com/photo-1431540012322-8b4d2dd1d4f2?auto=format&fit=crop&w=1600&q=80',
        agenda: [
          { time: '09:00', title: 'Agenda setting', description: 'Review Q1 events and training calendar.' },
        ],
      },
    ];

    const saved: Event[] = [];
    for (const def of definitions) {
      let event = await this.eventsRepository.findOne({ where: { slug: def.slug } });
      if (!event) {
        event = await this.eventsRepository.save(this.eventsRepository.create(def));
        this.logger.log(`Seeded event: ${event.title}`);
      }
      saved.push(event);
    }
    return saved;
  }

  private async seedRegistrations(users: User[], events: Event[]) {
    const byEmail = Object.fromEntries(users.map(user => [user.email, user]));
    const bySlug = Object.fromEntries(events.map(event => [event.slug, event]));

    const pairs: Array<[string, string]> = [
      ['lars.nielsen@example.com', '/events/aarsmoede-2026'],
      ['anne.pedersen@example.com', '/events/aarsmoede-2026'],
      ['fatima.hassan@example.com', '/events/aarsmoede-2026'],
      ['lars.nielsen@example.com', '/events/ev-transition-workshop'],
      ['mikkel.sorensen@example.com', '/events/open-taxi-meetup'],
      ['anne.pedersen@example.com', '/events/open-taxi-meetup'],
      ['lars.nielsen@example.com', '/events/summer-kickoff-2026'],
      ['fatima.hassan@example.com', '/events/summer-kickoff-2026'],
    ];

    for (const [email, slug] of pairs) {
      const user = byEmail[email];
      const event = bySlug[slug];
      if (!user || !event) {
        continue;
      }

      const existing = await this.registrationsRepository.findOne({
        where: { eventId: event.id, userId: user.id },
      });
      if (existing) {
        continue;
      }

      await this.registrationsRepository.save(
        this.registrationsRepository.create({
          eventId: event.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          status: RegistrationStatus.REGISTERED,
        }),
      );
    }
  }

  private async seedCategories() {
    const definitions: Array<{ name: string; description: string; urgency: CategoryUrgency }> = [
      {
        name: 'Payment Problem',
        description: 'Issues with membership payments, invoices, or receipts.',
        urgency: 'CRITICAL',
      },
      {
        name: 'Event Registration Problem',
        description: 'Cannot register, missing confirmation, or event booking issues.',
        urgency: 'HIGH',
      },
      {
        name: 'General Question',
        description: 'Non-urgent questions about membership, events, or the association.',
        urgency: 'MEDIUM',
      },
    ];

    const saved: Record<string, Category> = {};
    for (const def of definitions) {
      let category = await this.categoriesRepository.findOne({ where: { name: def.name } });
      if (!category) {
        category = await this.categoriesRepository.save(
          this.categoriesRepository.create({
            ...def,
            urgencyRank: CATEGORY_URGENCY_RANK[def.urgency],
          }),
        );
        this.logger.log(`Seeded category: ${category.name}`);
      }
      saved[category.name] = category;
    }
    return saved;
  }

  private async seedSupport(users: User[], categories: Record<string, Category>) {
    const existing = await this.conversationsRepository.count();
    if (existing > 0) {
      return;
    }

    const byEmail = Object.fromEntries(users.map((user) => [user.email, user]));
    const threads: Array<{
      email: string;
      category: string;
      subject: string;
      memberMessage: string;
      adminReply?: string;
      status: string;
      unreadForAdmin: boolean;
      unreadForMember: boolean;
    }> = [
      {
        email: 'lars.nielsen@example.com',
        category: 'Event Registration Problem',
        subject: 'I cannot register for Årsmøde 2026',
        memberMessage: 'I am having an issue with my event registration. The button stays disabled.',
        adminReply: 'We checked your registration. Please try again now.',
        status: SupportStatus.OPEN,
        unreadForAdmin: false,
        unreadForMember: true,
      },
      {
        email: 'anne.pedersen@example.com',
        category: 'Payment Problem',
        subject: 'Invoice missing for Vognmand plan',
        memberMessage: 'I paid for the Vognmand plan but have not received an invoice.',
        status: SupportStatus.OPEN,
        unreadForAdmin: true,
        unreadForMember: false,
      },
      {
        email: 'fatima.hassan@example.com',
        category: 'General Question',
        subject: 'How do I update my membership card?',
        memberMessage: 'Where can I download the digital membership card after renewing?',
        adminReply: 'You can download it from Profile after your membership is active.',
        status: SupportStatus.RESOLVED,
        unreadForAdmin: false,
        unreadForMember: false,
      },
    ];

    for (const thread of threads) {
      const user = byEmail[thread.email];
      const category = categories[thread.category];
      if (!user || !category) {
        continue;
      }

      const createdAt = new Date();
      const conversation = await this.conversationsRepository.save(
        this.conversationsRepository.create({
          userId: user.id,
          categoryId: category.id,
          subject: thread.subject,
          status: thread.status,
          lastMessage: preview(thread.adminReply || thread.memberMessage),
          lastMessageAt: createdAt,
          lastSenderType: thread.adminReply ? SupportSenderType.ADMIN : SupportSenderType.MEMBER,
          unreadForAdmin: thread.unreadForAdmin,
          unreadForMember: thread.unreadForMember,
        }),
      );

      await this.messagesRepository.save(
        this.messagesRepository.create({
          conversationId: conversation.id,
          senderType: SupportSenderType.MEMBER,
          senderId: user.id,
          body: thread.memberMessage,
          isRead: !thread.unreadForAdmin,
        }),
      );

      if (thread.adminReply) {
        await this.messagesRepository.save(
          this.messagesRepository.create({
            conversationId: conversation.id,
            senderType: SupportSenderType.ADMIN,
            senderId: user.id,
            body: thread.adminReply,
            isRead: !thread.unreadForMember,
          }),
        );
      }
    }
  }
}

function preview(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}
