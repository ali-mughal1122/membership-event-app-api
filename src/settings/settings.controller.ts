import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateWhatsAppSettingDto } from './dto/update-whatsapp-setting.dto';
import {
  WhatsAppSettingAdminResponseDto,
  WhatsAppSettingPublicResponseDto,
} from './dto/whatsapp-setting-response.dto';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('whatsapp/public')
  @ApiOperation({ summary: 'Get public WhatsApp contact configuration' })
  @ApiResponse({ status: 200, type: WhatsAppSettingPublicResponseDto })
  getPublicWhatsAppSettings(): Promise<WhatsAppSettingPublicResponseDto> {
    return this.settingsService.getPublicWhatsAppSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get('whatsapp')
  @ApiOperation({ summary: 'Get WhatsApp contact configuration (Admin only)' })
  @ApiResponse({ status: 200, type: WhatsAppSettingAdminResponseDto })
  getAdminWhatsAppSettings(): Promise<WhatsAppSettingAdminResponseDto> {
    return this.settingsService.getAdminWhatsAppSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Put('whatsapp')
  @ApiOperation({ summary: 'Update WhatsApp contact configuration (Admin only)' })
  @ApiResponse({ status: 200, type: WhatsAppSettingAdminResponseDto })
  updateWhatsAppSettings(
    @Body() updateDto: UpdateWhatsAppSettingDto,
  ): Promise<WhatsAppSettingAdminResponseDto> {
    return this.settingsService.updateWhatsAppSettings(updateDto);
  }
}

