import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Request,
    UnauthorizedException,
    InternalServerErrorException,
    Query,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import * as Sentry from '@sentry/node';
import { NotificationSettingData, Notification } from '../common/interfaces';
import { AuthGuard } from '../common/auth.guard';
import { Public } from '../common/public.decorator';
import { AuthService } from '../auth/auth.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationController {
    constructor(
        private readonly notificationService: NotificationService,
        private readonly authService: AuthService,
    ) { }

    @Public()
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

    @Public()
    @Post('settings/:eventId')
    async updateSetting(
        @Param('eventId') eventId: number,
        @Body() body: { isMuted: boolean }
    ): Promise<{ status: string; message: string }> {
        if (!eventId || isNaN(eventId)) {
            throw new BadRequestException('Invalid or missing event ID');
        }

        return Sentry.startSpan({ op: 'controller', name: `Update Notification Setting: ${eventId}` }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: `Updating notification setting for event ID: ${eventId}` });
                await this.notificationService.updateNotificationSetting(eventId, body.isMuted);
                return {
                    status: 'success',
                    message: `Notification setting for event ID: ${eventId} updated successfully`,
                };
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

    @Public()
    @Get('settings/:eventId')
    async isMuted(
        @Param('eventId') eventId: number
    ): Promise<{ status: string; message: string; data?: { isMuted?: boolean } }> {
        if (!eventId) {
            throw new BadRequestException('Event ID is missing');
        }

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

    @Get(':eventId?')
    async getNotifications(
        @Request() req,
        @Param('eventId') eventId?: number,
        @Query('page') page = 1, // Default to page 1
        @Query('limit') limit = 10 // Default limit
    ): Promise<{ status: string; message: string; data: Notification[], totalCount: number; }> {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            Sentry.captureMessage('Token is missing in request');
            throw new UnauthorizedException('Token is missing');
        }

        return Sentry.startSpan(
            { op: 'controller', name: 'Get Notifications' },
            async (span) => {
                try {
                    const decodedToken = await this.authService.decodeToken(token);
                    const tenantId = decodedToken?.tenant_id;

                    if (!tenantId) {
                        Sentry.captureMessage('Tenant ID not found in token');
                        throw new UnauthorizedException('Tenant ID not found in token');
                    }

                    if (page <= 0 || limit <= 0) {
                        throw new BadRequestException('Page and limit must be positive integers');
                    }

                    Sentry.addBreadcrumb({ message: `Fetching notifications for tenant ID: ${tenantId}` });
                    const { notifications, total } = await this.notificationService.getNotifications(tenantId, eventId, page, limit);

                    const totalPages = Math.ceil(total / limit);

                    if (page > totalPages && total > 0) {
                        throw new NotFoundException(`Page ${page} exceeds available total pages (${totalPages})`);
                    }

                    const message = eventId
                        ? `Fetched notifications for tenant ID: ${tenantId}, event ID: ${eventId}`
                        : `Fetched all notifications for tenant ID: ${tenantId}`;

                    return {
                        status: 'success',
                        message,
                        data: notifications,
                        totalCount: total
                    };
                } catch (error) {
                    if (error instanceof NotFoundException) {
                        throw new NotFoundException('No notifications found for the given criteria');
                    } else if (error instanceof BadRequestException) {
                        throw new BadRequestException('Invalid pagination parameters');
                    }
                    Sentry.captureException(error);
                    throw new InternalServerErrorException('Failed to fetch notifications');
                } finally {
                    span.end();
                }
            }
        );
    }
}
