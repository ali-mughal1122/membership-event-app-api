import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review } from './entities/review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewsRepository: Repository<Review>,
  ) {}

  async create(userId: string, createReviewDto: CreateReviewDto) {
    const existing = await this.reviewsRepository.findOne({
      where: { user: { id: userId } }
    });
    if (existing) {
      throw new ConflictException('User has already submitted a review. Please update your existing review instead.');
    }
    
    const review = this.reviewsRepository.create({
      ...createReviewDto,
      user: { id: userId }
    });
    
    return this.reviewsRepository.save(review);
  }

  async findLatest(limit: number = 6) {
    const reviews = await this.reviewsRepository.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
      take: limit,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: {
          id: true,
          name: true,
          email: true,
          profileImage: true,
        }
      }
    });

    const fs = require('fs');
    const path = require('path');
    
    return reviews.map(review => {
      let profileImageBase64: string | null = null;
      if (review.user?.profileImage) {
        try {
          const filePath = path.join(process.cwd(), 'uploads/profiles', review.user.profileImage);
          if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath);
            const ext = review.user.profileImage.split('.').pop() || 'png';
            profileImageBase64 = `data:image/${ext};base64,${fileData.toString('base64')}`;
          }
        } catch (e) {}
      }
      review.user.profileImage = profileImageBase64 as any;
      return review;
    });
  }

  async findMyReview(userId: string) {
    const review = await this.reviewsRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });
    
    if (review) {
       // Only return safe user fields
       const { password, phone, address, type, profileImage, ...safeUser } = review.user as any;
       
       let profileImageBase64: string | null = null;
       if (profileImage) {
         try {
           const fs = require('fs');
           const path = require('path');
           const filePath = path.join(process.cwd(), 'uploads/profiles', profileImage);
           if (fs.existsSync(filePath)) {
             const fileData = fs.readFileSync(filePath);
             const ext = profileImage.split('.').pop() || 'png';
             profileImageBase64 = `data:image/${ext};base64,${fileData.toString('base64')}`;
           }
         } catch (e) {}
       }
       
       review.user = { ...safeUser, profileImage: profileImageBase64 } as any;
    }
    return review;
  }

  async update(userId: string, updateReviewDto: UpdateReviewDto) {
    const existing = await this.reviewsRepository.findOne({
      where: { user: { id: userId } }
    });
    
    if (!existing) {
      throw new ConflictException('Review not found for this user.');
    }
    
    await this.reviewsRepository.update(existing.id, updateReviewDto);
    return this.findMyReview(userId);
  }
}
