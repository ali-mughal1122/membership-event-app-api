import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsResponseDto } from './dto/news-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  /**
   * GET /api/news
   * Public: returns published news sorted by publishedAt DESC, supports pagination & ?limit=3 & ?category=
   */
  @Get()
  @ApiOperation({ summary: 'Get published news articles (supports category, search, pagination, limit)' })
  @ApiResponse({ status: 200, type: [NewsResponseDto] })
  findPublished(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.newsService.findPublished({ page, limit, category, search });
  }

  /**
   * GET /api/news/admin/all
   * Admin only: returns all articles (both drafts and published)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({ summary: 'Admin list of all news articles (including drafts)' })
  @ApiResponse({ status: 200, type: [NewsResponseDto] })
  findAllAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    return this.newsService.findAllAdmin({ page, limit, category, search, isPublished });
  }

  /**
   * GET /api/news/:slug
   * Public or authenticated: fetch single article by slug or ID
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  @ApiOperation({ summary: 'Get a single news article by slug or ID' })
  @ApiResponse({ status: 200, type: NewsResponseDto })
  findOne(@Param('slug') slug: string, @Request() req: any) {
    const isAdmin = req.user?.type === 'ADMIN';
    return this.newsService.findBySlugOrId(slug, !isAdmin);
  }

  /**
   * POST /api/news
   * Admin only: create article
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new news article (Admin only)' })
  @ApiResponse({ status: 201, type: NewsResponseDto })
  create(@Body() createDto: CreateNewsDto) {
    return this.newsService.create(createDto);
  }

  /**
   * PATCH /api/news/:id
   * Admin only: update article
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing news article (Admin only)' })
  @ApiResponse({ status: 200, type: NewsResponseDto })
  update(@Param('id') id: string, @Body() updateDto: UpdateNewsDto) {
    return this.newsService.update(id, updateDto);
  }

  /**
   * DELETE /api/news/:id
   * Admin only: delete article
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a news article (Admin only)' })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }
}

