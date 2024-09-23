import {
    Controller,
    Get,
    InternalServerErrorException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import * as Sentry from '@sentry/node';
import { NotificationSetting, NotificationSettingData } from '../common/interfaces';

@Controller('notifications')
export class NotificationController {
    constructor(
        private readonly notificationService: NotificationService,
    ) { }

    @Get('settings')
    async getAllSettings(): Promise<{ status: string; message: string; data: NotificationSettingData[] }> {
        return Sentry.startSpan({ op: 'controller', name: 'Get Notification Settings' }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: 'Fetching all notification settings' });
                const settings = await this.notificationService.getNotificationSettings();
                return {
                    status: 'success',
                    message: 'Notification settings fetched successfully',
                    data: settings,
                };
            } catch (error) {
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to fetch notification settings');
            } finally {
                span.end();
            }
        });
    }
}
