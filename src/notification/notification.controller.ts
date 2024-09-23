import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    InternalServerErrorException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import * as Sentry from '@sentry/node';
import { NotificationSettingData } from '../common/interfaces';

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

    @Post('settings/:eventId')
    async updateSetting(
        @Param('eventId') eventId: number,
        @Body() body: { isMuted: boolean }
    ): Promise<{ status: string; message: string }> {
        return Sentry.startSpan({ op: 'controller', name: `Update Notification Setting: ${eventId}` }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: `Updating notification setting for event ID: ${eventId}` });
                await this.notificationService.updateNotificationSetting(eventId, body.isMuted);
                return {
                    status: 'success',
                    message: `Notification setting for event ID: ${eventId} updated successfully`,
                };
            } catch (error) {
                if (error instanceof InternalServerErrorException && error.message.includes('No notification setting found')) {
                    throw new InternalServerErrorException(`No notification setting found for event ID: ${eventId}`);
                }
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to update notification setting');
            } finally {
                span.end();
            }
        });
    }

    @Get('settings/:eventId')
    async isMuted(@Param('eventId') eventId: number): Promise<{ status: string; message: string; data?: { isMuted?: boolean } }> {
        return Sentry.startSpan({ op: 'controller', name: `Check if muted: ${eventId}` }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: `Checking if event ID ${eventId} is muted` });
                const isMuted = await this.notificationService.isNotificationMuted(eventId);
                return {
                    status: 'success',
                    message: `Checked mute status for event ID: ${eventId}`,
                    data: { isMuted },
                };
            } catch (error) {
                if (error instanceof InternalServerErrorException && error.message.includes('No notification setting found')) {
                    throw new InternalServerErrorException(`No notification setting found for event ID: ${eventId}`);
                }
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to check mute status');
            } finally {
                span.end();
            }
        });
    }
}
