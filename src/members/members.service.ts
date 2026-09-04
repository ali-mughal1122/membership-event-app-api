import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Member } from './entities/member.entity';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { PaginationQuery, parsePagination, paginated } from '../common/pagination';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(Member)
    private membersRepository: Repository<Member>,
  ) {}

  async findAll(query: PaginationQuery = {}) {
    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const qb = this.membersRepository.createQueryBuilder('member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('member.plan', 'plan')
      .orderBy('member.startDate', 'DESC');

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(user.name) LIKE :search OR LOWER(user.email) LIKE :search OR LOWER(plan.name) LIKE :search)', { search });
    }

    if (query.duration) {
      qb.andWhere('plan.durationMonths = :duration', { duration: Number(query.duration) });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (query.status === 'Active') {
      qb.andWhere('member.status = :activeStatus AND member.endDate >= :today', { activeStatus: 'ACTIVE', today });
    } else if (query.status === 'Expired') {
      qb.andWhere('(member.status = :expiredStatus OR (member.status = :activeStatus AND member.endDate < :today))', {
        expiredStatus: 'EXPIRED',
        activeStatus: 'ACTIVE',
        today,
      });
    } else if (query.status === 'Pending') {
      qb.andWhere('member.status = :pendingStatus', { pendingStatus: 'PENDING' });
    }

    const total = await qb.getCount();
    const members = await qb.skip(skip).take(limit).getMany();
    return paginated(members.map(member => this.toAdminMember(member)), total, page, limit);
  }

  findAllActiveWithUsers() {
    return this.findAllActiveNonExpiredWithUsers();
  }

  async findAllActiveNonExpiredWithUsers() {
    const members = await this.membersRepository.find({
      where: { status: 'ACTIVE' },
      relations: { user: true, plan: true },
    });
    return members.filter(member => this.isMembershipCurrentlyActive(member));
  }

  async getActiveMembershipForUser(userId: string) {
    const member = await this.membersRepository.findOne({
      where: { user: { id: userId }, status: 'ACTIVE' },
      relations: { user: true, plan: true },
      order: { endDate: 'DESC' },
    });

    if (!member || !this.isMembershipCurrentlyActive(member)) {
      return null;
    }

    return member;
  }

  findByUserIds(userIds: string[]) {
    if (!userIds.length) {
      return Promise.resolve([] as Member[]);
    }
    return this.membersRepository.find({
      where: { user: { id: In(userIds) } },
      relations: { user: true, plan: true },
      order: { endDate: 'DESC' },
    });
  }

  getDisplayStatus(member: Member | null | undefined): string {
    if (!member) {
      return 'NONE';
    }

    if (['PENDING', 'CANCELLED', 'PAYMENT_FAILED', 'REJECTED'].includes(member.status)) {
      return member.status;
    }

    if (member.status === 'ACTIVE' && this.isExpired(member.endDate)) {
      return 'EXPIRED';
    }

    return member.status;
  }

  async getMyMembership(userId: string) {
    const member = await this.membersRepository.findOne({
      where: { user: { id: userId } },
      relations: { plan: true },
      order: { endDate: 'DESC' },
    });

    if (!member) {
      return null;
    }

    const remainingDays = this.computeRemainingDays(member.endDate);
    const displayStatus = this.getDisplayStatus(member);

    return {
      ...member,
      remainingDays: remainingDays < 0 ? 0 : remainingDays,
      displayStatus,
    };
  }

  create(createMemberDto: CreateMemberDto & { userId: string }) {
    const member = this.membersRepository.create({
      user: { id: createMemberDto.userId },
      plan: { id: createMemberDto.planId },
      startDate: new Date(createMemberDto.startDate),
      endDate: new Date(createMemberDto.endDate),
      status: 'ACTIVE',
    });
    return this.membersRepository.save(member);
  }

  update(id: string, updateMemberDto: UpdateMemberDto) {
    return this.membersRepository.update(id, {
      ...updateMemberDto,
      user: updateMemberDto.userId ? { id: updateMemberDto.userId } : undefined,
      plan: updateMemberDto.planId ? { id: updateMemberDto.planId } : undefined,
      startDate: updateMemberDto.startDate ? new Date(updateMemberDto.startDate) : undefined,
      endDate: updateMemberDto.endDate ? new Date(updateMemberDto.endDate) : undefined,
    });
  }

  async remove(id: string) {
    const result = await this.membersRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Member not found');
    }
    return { success: true };
  }

  removeByUserId(userId: string) {
    return this.membersRepository
      .createQueryBuilder()
      .delete()
      .from(Member)
      .where('"userId" = :userId', { userId })
      .execute();
  }

  async getPending() {
    const members = await this.membersRepository.find({
      where: { status: 'PENDING' },
      relations: { user: true, plan: true },
      order: { startDate: 'DESC' },
    });
    return members.map(member => this.toAdminMember(member));
  }

  async approvePending(id: string) {
    const result = await this.membersRepository.update(id, { status: 'ACTIVE' });
    if (!result.affected) {
      throw new NotFoundException('Pending member not found');
    }
    return { success: true };
  }

  async rejectPending(id: string) {
    await this.remove(id);
    return { success: true };
  }

  private toAdminMember(member: Member) {
    const displayStatus = this.getDisplayStatus(member);
    const statusLabel =
      displayStatus === 'ACTIVE' ? 'Active' :
      displayStatus === 'EXPIRED' ? 'Expired' :
      displayStatus === 'PENDING' ? 'Pending' :
      displayStatus;

    const remainingDays = this.computeRemainingDays(member.endDate);

    return {
      id: member.id,
      userId: member.user?.id,
      name: member.user?.name || member.user?.email?.split('@')[0] || 'Unknown',
      email: member.user?.email || '',
      plan: member.plan?.name || 'Unknown',
      planId: member.plan?.id,
      durationMonths: member.plan?.durationMonths,
      joinDate: member.startDate,
      expiryDate: member.endDate,
      remainingDays: remainingDays < 0 ? 0 : remainingDays,
      status: statusLabel,
    };
  }

  private isMembershipCurrentlyActive(member: Member) {
    return member.status === 'ACTIVE' && !this.isExpired(member.endDate);
  }

  private isExpired(endDate: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    return end < today;
  }

  private computeRemainingDays(endDate: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
}
