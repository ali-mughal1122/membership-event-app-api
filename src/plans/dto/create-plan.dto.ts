import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsString, IsOptional, IsArray } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Premium Plan' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Best value plan' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 49.99 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 12 })
  @IsInt()
  durationMonths: number;

  @ApiProperty({ example: ['Access to VIP events'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];
}
