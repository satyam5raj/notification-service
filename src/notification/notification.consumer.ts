import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { NotificationService } from './notification.service';
import * as Sentry from '@sentry/node';

@Injectable()
export class NotificationConsumer implements OnModuleInit {
    constructor(
        private readonly rabbitMQService: RabbitMQService,
        private readonly notificationService: NotificationService,
    ) { }

    async onModuleInit() {
        return Sentry.startSpan({ op: 'service', name: 'RabbitMQ Connect' }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: 'Connecting to RabbitMQ' });
                await this.rabbitMQService.connect();
                Sentry.addBreadcrumb({ message: 'Connected to RabbitMQ' });
                this.rabbitMQService.consumeMessages(this.handleMessage.bind(this));
            } catch (error) {
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to connect to RabbitMQ');
            } finally {
                span.end();
            }
        });
    }

    async handleMessage(msg: string) {
        return Sentry.startSpan({ op: 'service', name: 'Handle RabbitMQ Message' }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: 'Received RabbitMQ message', data: { msg } });
                const { tenantId, eventId, message } = JSON.parse(msg);

                await this.notificationService.createNotification(eventId, tenantId, message);

                Sentry.addBreadcrumb({ message: 'Notification created successfully', data: { eventId, tenantId } });
            } catch (error) {
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to process RabbitMQ message');
            } finally {
                span.end();
            }
        });
    }
}
