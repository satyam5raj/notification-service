import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { InternalServerErrorException } from '@nestjs/common';

const mockDatabaseService = {
  queryBuilder: jest.fn().mockReturnThis(),
  selectFrom: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn(),
  executeTakeFirst: jest.fn(),
  insertInto: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  updateTable: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
};

const mockRedisService = {
  set: jest.fn(),
  get: jest.fn(),
};

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let db: DatabaseService;
  let redis: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    notificationService = module.get<NotificationService>(NotificationService);
    db = module.get<DatabaseService>(DatabaseService);
    redis = module.get<RedisService>(RedisService);
  });

  describe('getNotificationSettings', () => {
    it('should return notification settings', async () => {
      const mockSettings = [{ id: 1, event_type: 'test', is_muted: true }];
      mockDatabaseService.execute.mockResolvedValue(mockSettings);

      const result = await notificationService.getNotificationSettings();

      expect(result).toEqual(mockSettings);
      expect(db.queryBuilder).toHaveBeenCalled();
    });

    it('should throw an InternalServerErrorException on error', async () => {
      mockDatabaseService.execute.mockRejectedValue(new Error('DB error'));

      await expect(notificationService.getNotificationSettings()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateNotificationSetting', () => {
    it('should update notification setting and cache in Redis', async () => {
      const eventId = 1;
      const isMuted = true;

      await notificationService.updateNotificationSetting(eventId, isMuted);

      expect(mockRedisService.set).toHaveBeenCalledWith(`notification_setting_${eventId}`, isMuted.toString());
    });

    it('should throw an InternalServerErrorException if no setting found', async () => {
      const eventId = 1;
      const isMuted = true;
      mockDatabaseService.executeTakeFirst.mockResolvedValue(null);

      await expect(notificationService.updateNotificationSetting(eventId, isMuted)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw an InternalServerErrorException on update failure', async () => {
      const eventId = 1;
      const isMuted = true;
      mockDatabaseService.executeTakeFirst.mockResolvedValue({ event_id: eventId });
      mockDatabaseService.execute.mockRejectedValue(new Error('Update error'));

      await expect(notificationService.updateNotificationSetting(eventId, isMuted)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('isNotificationMuted', () => {
    it('should return mute status from Redis if cached', async () => {
      const eventId = 1;
      mockRedisService.get.mockResolvedValue('true');

      const result = await notificationService.isNotificationMuted(eventId);

      expect(result).toBe(true);
      expect(mockRedisService.get).toHaveBeenCalledWith(`notification_setting_${eventId}`);
    });

    it('should return mute status from database if not cached', async () => {
      const eventId = 1;
      mockRedisService.get.mockResolvedValue(null);
      mockDatabaseService.executeTakeFirst.mockResolvedValue({ is_muted: true });

      const result = await notificationService.isNotificationMuted(eventId);

      expect(result).toBe(true);
      expect(mockDatabaseService.executeTakeFirst).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalledWith(`notification_setting_${eventId}`, 'true');
    });

    it('should throw an InternalServerErrorException if setting not found', async () => {
      const eventId = 1;
      mockRedisService.get.mockResolvedValue(null);
      mockDatabaseService.executeTakeFirst.mockResolvedValue(null);

      await expect(notificationService.isNotificationMuted(eventId)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw an InternalServerErrorException on error', async () => {
      const eventId = 1;
      mockRedisService.get.mockResolvedValue(null);
      mockDatabaseService.executeTakeFirst.mockRejectedValue(new Error('DB error'));

      await expect(notificationService.isNotificationMuted(eventId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createNotification', () => {
    it('should create a notification if not muted', async () => {
      const eventId = 1;
      const tenantId = 1;
      const message = 'Test notification';

      jest.spyOn(notificationService, 'isNotificationMuted').mockResolvedValue(false);

      await notificationService.createNotification(eventId, tenantId, message);

      expect(mockDatabaseService.insertInto).toHaveBeenCalledWith(
        'notifications'
      );
    });

    it('should skip creating notification if muted', async () => {
      const eventId = 1;
      const tenantId = 1;
      const message = 'Test notification';

      jest.spyOn(notificationService, 'isNotificationMuted').mockResolvedValue(true);

      await notificationService.createNotification(eventId, tenantId, message);

      expect(mockDatabaseService.insertInto).not.toHaveBeenCalled();
    });

    it('should throw an InternalServerErrorException on error', async () => {
      const eventId = 1;
      const tenantId = 1;
      const message = 'Test notification';

      mockRedisService.get.mockResolvedValue(false);
      mockDatabaseService.insertInto.mockReturnThis();
      mockDatabaseService.values.mockReturnThis();
      mockDatabaseService.execute.mockRejectedValue(new Error('Create error'));

      await expect(notificationService.createNotification(eventId, tenantId, message)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getNotifications', () => {
    it('should return notifications and total count', async () => {
      const tenantId = 1;
      const eventId = 1;
      const page = 1;
      const limit = 10;
      const mockNotifications = [{ id: 1, message: 'Test' }];
      const total = 5;

      mockDatabaseService.execute.mockResolvedValue([mockNotifications, total]);

      const result = await notificationService.getNotifications(tenantId, eventId, page, limit);

      expect(result).toEqual({ mockNotifications, total });
      expect(db.queryBuilder).toHaveBeenCalled();
    });

    it('should throw an InternalServerErrorException on error', async () => {
      const tenantId = 1;
      const eventId = 1;
      const page = 1;
      const limit = 10;

      mockDatabaseService.execute.mockRejectedValue(new Error('DB error'));

      await expect(notificationService.getNotifications(tenantId, eventId, page, limit)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
