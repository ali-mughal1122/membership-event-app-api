import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { News } from './entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { paginated, PaginatedResult, parsePagination } from '../common/pagination';

export interface NewsQuery {
  page?: number | string;
  limit?: number | string;
  category?: string;
  search?: string;
  isPublished?: string | boolean;
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    @InjectRepository(News)
    private readonly newsRepository: Repository<News>,
  ) { }

  /**
   * Helper to generate a URL-friendly slug from a title
   */
  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Ensure slug is unique by appending counter if needed
   */
  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const baseSlug = this.slugify(title) || 'news';
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const qb = this.newsRepository.createQueryBuilder('news').where('news.slug = :slug', { slug });
      if (excludeId) {
        qb.andWhere('news.id != :excludeId', { excludeId });
      }
      const existing = await qb.getOne();
      if (!existing) {
        return slug;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Public: Find published news articles with category filter, search, pagination, or limit
   */
  async findPublished(query: NewsQuery): Promise<PaginatedResult<News>> {
    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const qb = this.newsRepository
      .createQueryBuilder('news')
      .where('news.isPublished = :isPublished', { isPublished: true });

    if (query.category && query.category.trim() && query.category.toLowerCase() !== 'all') {
      qb.andWhere('LOWER(news.category) = LOWER(:category)', { category: query.category.trim() });
    }

    if (query.search && query.search.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(news.title) LIKE :search OR LOWER(news.summary) LIKE :search)', { search });
    }

    qb.orderBy('news.publishedAt', 'DESC')
      .addOrderBy('news.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, page, limit);
  }

  /**
   * Admin: Find all news articles (both published and drafts)
   */
  async findAllAdmin(query: NewsQuery): Promise<PaginatedResult<News>> {
    const { page, limit, skip } = parsePagination(query.page, query.limit);
    const qb = this.newsRepository.createQueryBuilder('news');

    if (query.isPublished !== undefined && query.isPublished !== '') {
      const isPub = query.isPublished === 'true' || query.isPublished === true;
      qb.andWhere('news.isPublished = :isPub', { isPub });
    }

    if (query.category && query.category.trim() && query.category.toLowerCase() !== 'all') {
      qb.andWhere('LOWER(news.category) = LOWER(:category)', { category: query.category.trim() });
    }

    if (query.search && query.search.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(news.title) LIKE :search OR LOWER(news.summary) LIKE :search)', { search });
    }

    qb.orderBy('news.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, page, limit);
  }

  /**
   * Public & Admin: Find a single news article by slug or by UUID
   */
  async findBySlugOrId(identifier: string, isPublic = true): Promise<News> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identifier,
    );

    const qb = this.newsRepository.createQueryBuilder('news');
    if (isUuid) {
      qb.where('news.id = :identifier', { identifier });
    } else {
      qb.where('news.slug = :identifier', { identifier });
    }

    if (isPublic) {
      qb.andWhere('news.isPublished = :isPublished', { isPublished: true });
    }

    const news = await qb.getOne();
    if (!news) {
      throw new NotFoundException(`News article '${identifier}' not found`);
    }

    return news;
  }

  /**
   * Admin: Create a new news article
   */
  async create(createDto: CreateNewsDto): Promise<News> {
    const title = (createDto.title || '').trim();
    if (!title) {
      throw new BadRequestException('Title is required');
    }

    const slug = createDto.slug && createDto.slug.trim()
      ? await this.generateUniqueSlug(createDto.slug)
      : await this.generateUniqueSlug(title);

    const isPublished = createDto.isPublished !== undefined ? Boolean(createDto.isPublished) : true;
    let publishedAt: Date | null = null;
    if (isPublished) {
      publishedAt = createDto.publishedAt ? new Date(createDto.publishedAt) : new Date();
    }

    const news = this.newsRepository.create({
      title,
      slug,
      category: (createDto.category || 'General').trim(),
      summary: (createDto.summary || '').trim(),
      content: createDto.content || '',
      coverImage: createDto.coverImage?.trim() || null,
      isPublished,
      publishedAt,
    });

    return this.newsRepository.save(news);
  }

  /**
   * Admin: Update an existing news article
   */
  async update(id: string, updateDto: UpdateNewsDto): Promise<News> {
    const news = await this.findBySlugOrId(id, false);

    if (updateDto.title !== undefined) {
      const title = updateDto.title.trim();
      if (!title) throw new BadRequestException('Title cannot be empty');
      news.title = title;
      if (updateDto.slug === undefined) {
        // If title changed and slug not specified, retain current slug or re-slug if requested
      }
    }

    if (updateDto.slug !== undefined && updateDto.slug.trim()) {
      news.slug = await this.generateUniqueSlug(updateDto.slug.trim(), news.id);
    }

    if (updateDto.category !== undefined) {
      news.category = updateDto.category.trim() || 'General';
    }

    if (updateDto.summary !== undefined) {
      news.summary = updateDto.summary.trim();
    }

    if (updateDto.content !== undefined) {
      news.content = updateDto.content;
    }

    if (updateDto.coverImage !== undefined) {
      news.coverImage = updateDto.coverImage?.trim() || null;
    }

    if (updateDto.isPublished !== undefined) {
      const wasPublished = news.isPublished;
      news.isPublished = Boolean(updateDto.isPublished);
      if (news.isPublished && !wasPublished && !news.publishedAt) {
        news.publishedAt = new Date();
      }
    }

    if (updateDto.publishedAt !== undefined) {
      news.publishedAt = updateDto.publishedAt ? new Date(updateDto.publishedAt) : null;
    }

    return this.newsRepository.save(news);
  }

  /**
   * Admin: Delete a news article
   */
  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const news = await this.findBySlugOrId(id, false);
    await this.newsRepository.remove(news);
    return { success: true, message: `News article '${news.title}' deleted successfully` };
  }
}

