import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { WhatsAppSetting } from './entities/whatsapp-setting.entity';
import { BadRequestException } from '@nestjs/common';

describe('SettingsService', () => {
  let service: SettingsService;
  let mockRepository: any;

  const mockSetting: WhatsAppSetting = {
    id: 'test-uuid',
    countryCode: '+45',
    phoneNumber: '12 34 56 78',
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn().mockResolvedValue([mockSetting]),
      findOne: jest.fn().mockResolvedValue(mockSetting),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...mockSetting, ...entity })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        SettingsService,
        {
          provide: getRepositoryToken(WhatsAppSetting),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPublicWhatsAppSettings', () => {
    it('should return public formatted settings when enabled', async () => {
      const res = await service.getPublicWhatsAppSettings();
      expect(res.isEnabled).toBe(true);
      expect(res.whatsappUrl).toBe('https://wa.me/4512345678');
      expect(res.formattedNumber).toBe('+45 12 34 56 78');
    });

    it('should return isEnabled: false if setting is disabled', async () => {
      mockRepository.find.mockResolvedValue([{ ...mockSetting, isEnabled: false }]);
      const res = await service.getPublicWhatsAppSettings();
      expect(res.isEnabled).toBe(false);
      expect(res.whatsappUrl).toBeNull();
      expect(res.formattedNumber).toBeNull();
    });
  });

  describe('updateWhatsAppSettings', () => {
    it('should reject invalid phone length when isEnabled is true', async () => {
      await expect(
        service.updateWhatsAppSettings({
          countryCode: '+45',
          phoneNumber: '12',
          isEnabled: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update settings successfully with valid input', async () => {
      const res = await service.updateWhatsAppSettings({
        countryCode: '+45',
        phoneNumber: '77 33 65 12',
        isEnabled: true,
      });

      expect(res.countryCode).toBe('+45');
      expect(res.phoneNumber).toBe('77 33 65 12');
      expect(res.whatsappUrl).toBe('https://wa.me/4577336512');
      expect(res.formattedNumber).toBe('+45 77 33 65 12');
    });
  });
});

