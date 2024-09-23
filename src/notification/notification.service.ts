import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as Sentry from '@sentry/node';
import { NotificationSetting, NotificationSettingData } from '../common/interfaces';

@Injectable()
export class NotificationService {
    constructor(
        private readonly db: DatabaseService,
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
}