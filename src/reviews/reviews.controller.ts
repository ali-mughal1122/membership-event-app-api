import { Controller, Get, Post, Body, Put, UseGuards, Request, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Get latest reviews' })
  findLatest(@Query('limit') limit?: number) {
    return this.reviewsService.findLatest(limit ? Number(limit) : 6);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'CLIENT', 'ADMIN') // Adjust based on your valid roles, 'USER' seems common here.
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user review' })
  async findMyReview(@Request() req) {
    const review = await this.reviewsService.findMyReview(req.user.userId);
    return review || {};
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'CLIENT', 'ADMIN')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Submit a new review' })
  create(@Request() req, @Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.create(req.user.userId, createReviewDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'CLIENT', 'ADMIN')
  @ApiBearerAuth()
  @Put()
  @ApiOperation({ summary: 'Update your review' })
  update(@Request() req, @Body() updateReviewDto: UpdateReviewDto) {
    return this.reviewsService.update(req.user.userId, updateReviewDto);
  }
}
