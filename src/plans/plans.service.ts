import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PaginationQuery, parsePagination, paginated } from '../common/pagination';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private plansRepository: Repository<Plan>,
  ) {}

  findAll(): Promise<Plan[]> {
    return this.plansRepository.find();
  }

  async findPaged(query: PaginationQuery = {}) {
    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const qb = this.plansRepository.createQueryBuilder('plan').orderBy('plan.name', 'ASC');

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('LOWER(plan.name) LIKE :search', { search });
    }

    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();
    return paginated(data, total, page, limit);
  }

  create(createPlanDto: CreatePlanDto): Promise<Plan> {
    const newPlan = this.plansRepository.create(createPlanDto);
    return this.plansRepository.save(newPlan);
  }

  async update(id: string, updatePlanDto: UpdatePlanDto): Promise<Plan | null> {
    await this.plansRepository.update(id, updatePlanDto);
    return this.plansRepository.findOneBy({ id });
  }

  async remove(id: string): Promise<void> {
    await this.plansRepository.softDelete(id);
  }
}
