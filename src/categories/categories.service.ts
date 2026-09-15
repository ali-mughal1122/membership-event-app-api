import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationQuery, parsePagination, paginated } from '../common/pagination';
import { CATEGORY_URGENCY_RANK, CATEGORY_URGENCY_VALUES, CategoryUrgency } from './category-urgency';
import { SupportConversation } from '../support/entities/support-conversation.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(SupportConversation)
    private conversationsRepository: Repository<SupportConversation>,
  ) {}

  async findOptions() {
    return this.categoriesRepository.find({
      order: { name: 'ASC' },
      select: { id: true, name: true, description: true, urgency: true },
    });
  }

  async findAll(query: PaginationQuery = {}) {
    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const qb = this.categoriesRepository
      .createQueryBuilder('category')
      .orderBy('category.urgencyRank', 'ASC')
      .addOrderBy('category.createdAt', 'DESC');

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(category.name) LIKE :search OR LOWER(category.description) LIKE :search)', { search });
    }

    const urgency = String(query.status || '').toUpperCase();
    if (CATEGORY_URGENCY_VALUES.includes(urgency as CategoryUrgency)) {
      qb.andWhere('category.urgency = :urgency', { urgency });
    }

    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();
    return paginated(data, total, page, limit);
  }

  async findOne(id: string) {
    const category = await this.categoriesRepository.findOneBy({ id });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(createCategoryDto: CreateCategoryDto) {
    const name = createCategoryDto.name.trim();
    await this.assertUniqueName(name);

    const urgency = createCategoryDto.urgency as CategoryUrgency;
    const category = this.categoriesRepository.create({
      name,
      description: createCategoryDto.description.trim(),
      urgency,
      urgencyRank: CATEGORY_URGENCY_RANK[urgency],
    });
    return this.categoriesRepository.save(category);
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (updateCategoryDto.name !== undefined) {
      const name = updateCategoryDto.name.trim();
      await this.assertUniqueName(name, id);
      category.name = name;
    }
    if (updateCategoryDto.description !== undefined) {
      category.description = updateCategoryDto.description.trim();
    }
    if (updateCategoryDto.urgency !== undefined) {
      category.urgency = updateCategoryDto.urgency as CategoryUrgency;
      category.urgencyRank = CATEGORY_URGENCY_RANK[category.urgency];
    }

    return this.categoriesRepository.save(category);
  }

  async remove(id: string) {
    const inUse = await this.conversationsRepository.count({ where: { categoryId: id } });
    if (inUse) {
      throw new ConflictException('This category is used by support conversations and cannot be deleted');
    }
    const result = await this.categoriesRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Category not found');
    }
    return { success: true };
  }

  private async assertUniqueName(name: string, excludeId?: string) {
    const existing = await this.categoriesRepository.findOne({
      where: excludeId
        ? { name: ILike(name), id: Not(excludeId) }
        : { name: ILike(name) },
    });
    if (existing) {
      throw new ConflictException('A category with this name already exists');
    }
  }
}
