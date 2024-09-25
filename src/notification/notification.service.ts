import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as Sentry from '@sentry/node';
import { NotificationSettingData, Notification } from '../common/interfaces';
import { RedisService } from '../redis/redis.service';

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
                if (!eventId || isNaN(eventId)) {
                    throw new BadRequestException('Invalid or missing event ID');
                }

                Sentry.addBreadcrumb({ message: `Checking if notification setting exists for event ID: ${eventId}` });
                const settingExists = await this.db.queryBuilder()
                    .selectFrom('notificationsettings')
                    .select('event_id')
                    .where('event_id', '=', eventId)
                    .executeTakeFirst();

                if (!settingExists) {
                    throw new NotFoundException(`No notification setting found for event ID: ${eventId}`);
                }

                Sentry.addBreadcrumb({ message: `Updating notification setting in database for event ID: ${eventId}` });
                await this.db.queryBuilder()
                    .updateTable('notificationsettings')
                    .set({ is_muted: isMuted })
                    .where('event_id', '=', eventId)
                    .execute();

                Sentry.addBreadcrumb({ message: `Updating Redis cache for event ID: ${eventId}` });
                await this.redisService.set(`notification_setting_${eventId}`, isMuted.toString());
            } catch (error) {
                if (error instanceof NotFoundException) {
                    throw new NotFoundException(`No notification setting found for event ID: ${eventId}`);
                } else if (error instanceof BadRequestException) {
                    throw new BadRequestException('Invalid or missing event ID');
                }
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
                if (!eventId || isNaN(eventId)) {
                    throw new BadRequestException('Invalid or missing event ID');
                }

                Sentry.addBreadcrumb({ message: `Checking mute status for event ID: ${eventId} in Redis` });
                const cachedSetting = await this.redisService.get(`notification_setting_${eventId}`);

                if (cachedSetting !== null) {
                    const isMuted = cachedSetting === 'true';
                    Sentry.addBreadcrumb({ message: `Found cached mute status for event ID: ${eventId}, isMuted: ${isMuted}` });
                    return isMuted;
                }

                Sentry.addBreadcrumb({ message: `Querying mute status for event ID: ${eventId} from the database` });
                const setting = await this.db.queryBuilder()
                    .selectFrom('notificationsettings')
                    .select('is_muted')
                    .where('event_id', '=', eventId)
                    .executeTakeFirst();

                if (!setting) {
                    throw new NotFoundException(`No notification setting found for event ID: ${eventId}`);
                }

                const isMuted = setting.is_muted;
                Sentry.addBreadcrumb({ message: `Caching mute status for event ID: ${eventId}` });
                await this.redisService.set(`notification_setting_${eventId}`, isMuted.toString());

                return isMuted;
            } catch (error) {
                if (error instanceof NotFoundException) {
                    throw new NotFoundException(`No notification setting found for event ID: ${eventId}`);
                } else if (error instanceof BadRequestException) {
                    throw new BadRequestException('Invalid or missing event ID');
                }
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to check mute status');
            } finally {
                span.end();
            }
        });
    }

    async createNotification(eventId: number, tenantId: number, message: string): Promise<void> {
        return Sentry.startSpan(
            { op: 'service', name: `Create Notification for Tenant: ${tenantId}, Event: ${eventId}` },
            async (span) => {
                try {
                    const isMuted = await this.isNotificationMuted(eventId);

                    Sentry.addBreadcrumb({
                        message: `Checked mute status for event ID: ${eventId}, isMuted: ${isMuted}`,
                    });

                    if (!isMuted) {
                        Sentry.addBreadcrumb({ message: `Creating notification for tenant ID: ${tenantId}, event ID: ${eventId}` });

                        await this.db.queryBuilder()
                            .insertInto('notifications')
                            .values({ event_id: eventId, tenant_id: tenantId, message })
                            .execute();
                    } else {
                        Sentry.addBreadcrumb({ message: `Notification for event ID: ${eventId} is muted, skipping creation.` });
                    }
                } catch (error) {
                    Sentry.captureException(error);
                    throw new InternalServerErrorException('Failed to create notification');
                } finally {
                    span.end();
                }
            },
        );
    }

    async getNotifications(
        tenantId: number,
        eventId?: number,
        page: number = 1,
        limit: number = 10
    ): Promise<{ notifications: Notification[], total: number; }> {
        return Sentry.startSpan({ op: 'service', name: `Get Notifications for Tenant: ${tenantId}` }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: `Fetching notifications for tenant ID: ${tenantId}` });
    
                let query = this.db.queryBuilder()
                    .selectFrom('notifications')
                    .selectAll()
                    .where('tenant_id', '=', tenantId);
    
                // Apply the event ID filter if provided
                if (eventId) {
                    query = query.where('event_id', '=', eventId);
                    Sentry.addBreadcrumb({ message: `Filtering notifications by event ID: ${eventId}` });
                    
                    const eventExists = await this.db.queryBuilder()
                        .selectFrom('notifications')
                        .select('event_id')
                        .where('event_id', '=', eventId)
                        .where('tenant_id', '=', tenantId)
                        .executeTakeFirst();
    
                    if (!eventExists) {
                        throw new NotFoundException(`No notifications found for event ID: ${eventId}`);
                    }
                }
    
                const offset = (page - 1) * limit;
    
                const totalResponse = await query.execute();
                const totalCount = totalResponse.length;
    
                if (totalCount === 0) {
                    return { notifications: [], total: 0 };
                }
    
                const notifications = await query.limit(limit).offset(offset).execute();
    
                return { notifications, total: totalCount };
            } catch (error) {
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to fetch notifications');
            } finally {
                span.end();
            }
        });
    }
}