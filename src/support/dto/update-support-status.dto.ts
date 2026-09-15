import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { SUPPORT_STATUS_VALUES } from '../support.constants';

export class UpdateSupportStatusDto {
  @ApiProperty({ enum: SUPPORT_STATUS_VALUES })
  @IsString()
  @IsNotEmpty()
  @IsIn(SUPPORT_STATUS_VALUES)
  status: string;
}
