import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNewsDto {
  @ApiProperty({ description: 'Article title', example: 'New EV Charging Agreement for Copenhagen Taxis' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Custom slug (auto-generated if omitted)', example: 'new-ev-charging-agreement' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ description: 'News category tag', example: 'Agreements' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Short summary or teaser snippet', example: 'Taxiterminalen has secured a discounted fast-charging deal...' })
  @IsString()
  @IsNotEmpty()
  summary: string;

  @ApiProperty({ description: 'Full article body (HTML or Markdown/text)', example: '<p>We are thrilled to announce a major discount framework...</p>' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Optional cover image URL', example: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2' })
  @IsString()
  @IsOptional()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Publish immediately flag', default: true })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'Publish date timestamp (ISO string)', example: '2026-11-17T12:00:00Z' })
  @IsOptional()
  publishedAt?: string | Date;
}

