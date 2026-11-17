import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NewsResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  summary: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional()
  coverImage: string | null;

  @ApiProperty()
  isPublished: boolean;

  @ApiPropertyOptional()
  publishedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

