import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { MembersService } from '../members/members.service';
import { PaginationQuery, parsePagination, paginated } from '../common/pagination';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private membersService: MembersService,
  ) {}

  async findAll(query: PaginationQuery = {}) {
    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const qb = this.usersRepository.createQueryBuilder('user')
      .where('user.type != :adminType', { adminType: 'ADMIN' })
      .orderBy('user.createdAt', 'DESC');

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(user.name) LIKE :search OR LOWER(user.email) LIKE :search OR LOWER(COALESCE(user.phone, \'\')) LIKE :search)', { search });
    }

    const total = await qb.getCount();
    const users = await qb.skip(skip).take(limit).getMany();
    const members = await this.membersService.findByUserIds(users.map(user => user.id));
    const latestMemberByUser = new Map<string, (typeof members)[number]>();
    for (const member of members) {
      const userId = member.user?.id;
      if (userId && !latestMemberByUser.has(userId)) {
        latestMemberByUser.set(userId, member);
      }
    }

    const data = users.map(user => {
      const membership = latestMemberByUser.get(user.id);
      return {
        id: user.id,
        name: user.name || user.email.split('@')[0],
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        createdAt: user.createdAt,
        membershipStatus: this.membersService.getDisplayStatus(membership),
        plan: membership?.plan?.name || null,
      };
    });

    return paginated(data, total, page, limit);
  }

  async remove(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.type === 'ADMIN') {
      throw new ForbiddenException('Admin accounts cannot be deleted');
    }

    await this.membersService.removeByUserId(id);
    await this.usersRepository.delete(id);
    return { success: true };
  }
}
