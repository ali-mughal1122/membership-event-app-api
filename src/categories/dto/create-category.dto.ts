import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CATEGORY_URGENCY_VALUES } from '../category-urgency';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Vehicle breakdown' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Taxi is out of service and needs immediate assistance.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @ApiProperty({ example: 'CRITICAL', enum: CATEGORY_URGENCY_VALUES })
  @IsString()
  @IsNotEmpty()
  @IsIn(CATEGORY_URGENCY_VALUES)
  urgency: string;
}
