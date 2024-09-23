import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as Sentry from '@sentry/node';
import { NotificationSettingData } from '../common/interfaces';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class NotificationService {
    constructor(
        private readonly db: DatabaseService,
        private readonly redisService: RedisService,
    ) { }

    async getNotificationSettings(): Promise<NotificationSettingData[]> {
        return Sentry.startSpan({ op: 'service', name: 'Get Notification Settings from DB' }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: 'Querying notification settings from the database' });
                const settings = await this.db.queryBuilder()
                    .selectFrom('notificationsettings')
                    .innerJoin('notificationevents', 'notificationevents.id', 'notificationsettings.event_id')
                    .select(['notificationsettings.id', 'notificationevents.event_type', 'notificationsettings.is_muted'])
                    .where('notificationsettings.is_muted', '=', true)
                    .execute();
                return settings;
            } catch (error) {
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to fetch notification settings');
            } finally {
                span.end();
            }
        });
    }

    async updateNotificationSetting(eventId: number, isMuted: boolean): Promise<void> {
        return Sentry.startSpan({ op: 'service', name: `Update Notification Setting: ${eventId}` }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: `Checking if notification setting exists for event ID: ${eventId}` });

                const settingExists = await this.db.queryBuilder()
                    .selectFrom('notificationsettings')
                    .select('event_id')
                    .where('event_id', '=', eventId)
                    .executeTakeFirst();

                if (!settingExists) {
                    throw new InternalServerErrorException(`No notification setting found for event ID: ${eventId}`);
                }

                Sentry.addBreadcrumb({ message: `Updating notification setting in database for event ID: ${eventId}` });
                await this.db.queryBuilder()
                    .updateTable('notificationsettings')
                    .set({ is_muted: isMuted })
                    .where('event_id', '=', eventId)
                    .execute();

                Sentry.addBreadcrumb({ message: `Updating Redis cache for event ID: ${eventId}` });
                // Inserting data into redis for quick lookup 
                await this.redisService.set(`notification_setting_${eventId}`, isMuted);
            } catch (error) {
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to update notification setting');
            } finally {
                span.end();
            }
        });
    }

    async isNotificationMuted(eventId: number): Promise<boolean> {
        return Sentry.startSpan({ op: 'service', name: `Check if muted: ${eventId}` }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: `Checking mute status for event ID: ${eventId} in Redis` });
                // Retrieving cached notification setting from Redis for quick lookup
                const cachedSetting = await this.redisService.get(`notification_setting_${eventId}`);

                if (cachedSetting !== null) {
                    Sentry.addBreadcrumb({ message: `Found cached mute status for event ID: ${eventId}` });
                    return cachedSetting;
                }

                Sentry.addBreadcrumb({ message: `Querying mute status for event ID: ${eventId} from the database` });
                const setting = await this.db.queryBuilder()
                    .selectFrom('notificationsettings')
                    .select('is_muted')
                    .where('event_id', '=', eventId)
                    .executeTakeFirst();

                if (setting === null) {
                    throw new InternalServerErrorException(`No notification setting found for event ID: ${eventId}`);
                }

                const isMuted = setting.is_muted;

                Sentry.addBreadcrumb({ message: `Caching mute status for event ID: ${eventId}` });
                await this.redisService.set(`notification_setting_${eventId}`, isMuted);

                return isMuted;
            } catch (error) {
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to check mute status');
            } finally {
                span.end();
            }
        });
    }
}