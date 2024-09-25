import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { AuthService } from '../auth/auth.service';
import { UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { NotificationSettingData, Notification } from '../common/interfaces';

const mockNotificationService = {
  getNotificationSettings: jest.fn(),
  updateNotificationSetting: jest.fn(),
  isNotificationMuted: jest.fn(),
  getNotifications: jest.fn(),
};

const mockAuthService = {
  decodeToken: jest.fn(),
};

describe('NotificationController', () => {
  let notificationController: NotificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    notificationController = module.get<NotificationController>(NotificationController);
  });

  describe('getAllSettings', () => {
    it('should return notification settings', async () => {
      const settings: NotificationSettingData[] = [];
      mockNotificationService.getNotificationSettings.mockResolvedValue(settings);

      const result = await notificationController.getAllSettings();

      expect(result).toEqual({
        status: 'success',
        message: 'Notification settings fetched successfully',
        data: settings,
      });
      expect(mockNotificationService.getNotificationSettings).toHaveBeenCalled();
    });

    it('should throw an InternalServerErrorException on error', async () => {
      mockNotificationService.getNotificationSettings.mockRejectedValue(new Error('error'));

      await expect(notificationController.getAllSettings()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateSetting', () => {
    it('should update notification setting', async () => {
      const eventId = 1;
      const body = { isMuted: true };

      await notificationController.updateSetting(eventId, body);

      expect(mockNotificationService.updateNotificationSetting).toHaveBeenCalledWith(eventId, body.isMuted);
    });

    it('should throw an InternalServerErrorException if no setting found', async () => {
      const eventId = 1;
      const body = { isMuted: true };
      mockNotificationService.updateNotificationSetting.mockRejectedValue(new InternalServerErrorException('No notification setting found'));

      await expect(notificationController.updateSetting(eventId, body)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('isMuted', () => {
    it('should return mute status', async () => {
      const eventId = 1;
      mockNotificationService.isNotificationMuted.mockResolvedValue(true);

      const result = await notificationController.isMuted(eventId);

      expect(result).toEqual({
        status: 'success',
        message: `Checked mute status for event ID: ${eventId}`,
        data: { isMuted: true },
      });
    });

    it('should throw an InternalServerErrorException on error', async () => {
      const eventId = 1;
      mockNotificationService.isNotificationMuted.mockRejectedValue(new Error('error'));

      await expect(notificationController.isMuted(eventId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getNotifications', () => {
    it('should return notifications with total count', async () => {
      const req = { headers: { authorization: 'Bearer token' } };
      const eventId = 1;
      const page = 1;
      const limit = 10;
      const notifications: Notification[] = [];
      const totalCount = 5;
      mockAuthService.decodeToken.mockResolvedValue({ tenant_id: 1 });
      mockNotificationService.getNotifications.mockResolvedValue({ notifications, total: totalCount });

      const result = await notificationController.getNotifications(req, eventId, page, limit);

      expect(result).toEqual({
        status: 'success',
        message: `Fetched notifications for tenant ID: 123, event ID: ${eventId}`,
        data: notifications,
        totalCount,
      });
    });

    it('should throw UnauthorizedException if token is missing', async () => {
      const req = { headers: {} };
      const eventId = 1;
      const page = 1;
      const limit = 10;

      await expect(notificationController.getNotifications(req, eventId, page, limit)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw an InternalServerErrorException on error', async () => {
      const req = { headers: { authorization: 'Bearer token' } };
      const eventId = 1;
      const page = 1;
      const limit = 10;
      mockAuthService.decodeToken.mockResolvedValue({ tenant_id: 123 });
      mockNotificationService.getNotifications.mockRejectedValue(new Error('error'));

      await expect(notificationController.getNotifications(req, eventId, page, limit)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
