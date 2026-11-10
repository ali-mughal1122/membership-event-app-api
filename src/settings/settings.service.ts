import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsAppSetting } from './entities/whatsapp-setting.entity';
import { UpdateWhatsAppSettingDto } from './dto/update-whatsapp-setting.dto';
import {
  WhatsAppSettingAdminResponseDto,
  WhatsAppSettingPublicResponseDto,
} from './dto/whatsapp-setting-response.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(WhatsAppSetting)
    private readonly whatsappSettingRepository: Repository<WhatsAppSetting>,
  ) {}

  /**
   * Helper to strip all non-digit characters
   */
  private cleanDigits(val: string): string {
    return (val || '').replace(/\D/g, '');
  }

  /**
   * Helper to clean country code digits (remove leading zeros)
   */
  private cleanCountryCode(val: string): string {
    const digits = this.cleanDigits(val);
    return digits.replace(/^0+/, '');
  }

  /**
   * Helper to clean phone number digits (remove leading trunk 0 if provided)
   */
  private cleanPhoneNumber(val: string): string {
    const digits = this.cleanDigits(val);
    return digits.replace(/^0+/, '');
  }

  /**
   * Build the WhatsApp click-to-chat URL: https://wa.me/<country_code_and_phone_number>
   * Only digits, no +, no spaces, no dashes
   */
  private buildWhatsAppUrl(countryCode: string, phoneNumber: string): string | null {
    const cc = this.cleanCountryCode(countryCode);
    const phone = this.cleanPhoneNumber(phoneNumber);
    if (!cc || !phone) return null;
    return `https://wa.me/${cc}${phone}`;
  }

  /**
   * Build clean formatted display number: +<country_code> <phone_number>
   */
  private buildFormattedNumber(countryCode: string, phoneNumber: string): string | null {
    const cc = this.cleanCountryCode(countryCode);
    const phone = (phoneNumber || '').trim();
    if (!cc || !phone) return null;
    return `+${cc} ${phone}`;
  }

  /**
   * Fetch or create default WhatsApp settings record
   */
  private async getOrCreateEntity(): Promise<WhatsAppSetting> {
    const list = await this.whatsappSettingRepository.find({
      order: { createdAt: 'ASC' },
      take: 1,
    });

    if (list && list.length > 0) {
      return list[0];
    }

    const created = this.whatsappSettingRepository.create({
      countryCode: '+45',
      phoneNumber: '',
      isEnabled: false,
    });
    return this.whatsappSettingRepository.save(created);
  }

  /**
   * Public endpoint - returns only safe, essential display data
   */
  async getPublicWhatsAppSettings(): Promise<WhatsAppSettingPublicResponseDto> {
    try {
      const setting = await this.getOrCreateEntity();
      const whatsappUrl = this.buildWhatsAppUrl(setting.countryCode, setting.phoneNumber);
      const isEnabled = Boolean(setting.isEnabled && whatsappUrl);

      return {
        isEnabled,
        whatsappUrl: isEnabled ? whatsappUrl : null,
        formattedNumber: isEnabled
          ? this.buildFormattedNumber(setting.countryCode, setting.phoneNumber)
          : null,
      };
    } catch (error) {
      this.logger.error('Failed to load public WhatsApp settings', error);
      return {
        isEnabled: false,
        whatsappUrl: null,
        formattedNumber: null,
      };
    }
  }

  /**
   * Admin endpoint - returns full configuration
   */
  async getAdminWhatsAppSettings(): Promise<WhatsAppSettingAdminResponseDto> {
    const setting = await this.getOrCreateEntity();
    const whatsappUrl = this.buildWhatsAppUrl(setting.countryCode, setting.phoneNumber);

    return {
      id: setting.id,
      countryCode: setting.countryCode,
      phoneNumber: setting.phoneNumber,
      isEnabled: setting.isEnabled,
      whatsappUrl,
      formattedNumber: this.buildFormattedNumber(setting.countryCode, setting.phoneNumber),
      updatedAt: setting.updatedAt,
    };
  }

  /**
   * Admin endpoint - validates and updates WhatsApp settings
   */
  async updateWhatsAppSettings(dto: UpdateWhatsAppSettingDto): Promise<WhatsAppSettingAdminResponseDto> {
    const ccDigits = this.cleanCountryCode(dto.countryCode);
    const phoneDigits = this.cleanPhoneNumber(dto.phoneNumber);

    // If enabled, strictly validate phone number and country code
    if (dto.isEnabled) {
      if (!ccDigits) {
        throw new BadRequestException('A valid country calling code is required (e.g. +45, +1, +44).');
      }

      if (!phoneDigits) {
        throw new BadRequestException('A phone number is required when WhatsApp contact is enabled.');
      }

      const totalDigits = ccDigits.length + phoneDigits.length;
      if (totalDigits < 7 || totalDigits > 15) {
        throw new BadRequestException(
          `Invalid phone number length (${totalDigits} digits). International phone numbers must have between 7 and 15 digits including country code.`,
        );
      }
    }

    const setting = await this.getOrCreateEntity();

    // Standardize countryCode format to start with '+'
    setting.countryCode = ccDigits ? `+${ccDigits}` : '+45';
    setting.phoneNumber = (dto.phoneNumber || '').trim();
    setting.isEnabled = Boolean(dto.isEnabled);

    const saved = await this.whatsappSettingRepository.save(setting);
    const whatsappUrl = this.buildWhatsAppUrl(saved.countryCode, saved.phoneNumber);

    return {
      id: saved.id,
      countryCode: saved.countryCode,
      phoneNumber: saved.phoneNumber,
      isEnabled: saved.isEnabled,
      whatsappUrl,
      formattedNumber: this.buildFormattedNumber(saved.countryCode, saved.phoneNumber),
      updatedAt: saved.updatedAt,
    };
  }
}
