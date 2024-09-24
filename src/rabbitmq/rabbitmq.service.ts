import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as amqp from 'amqplib';
import * as Sentry from '@sentry/node';

@Injectable()
export class RabbitMQService {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async connect() {
    return Sentry.startSpan({ op: 'service', name: 'RabbitMQ Connect' }, async (span) => {
      try {
        const rabbitMqUrl = process.env.RABBITMQ_URL;
        Sentry.addBreadcrumb({ message: `Connecting to RabbitMQ at ${rabbitMqUrl}` });
        this.connection = await amqp.connect(rabbitMqUrl);
        this.channel = await this.connection.createChannel();
        Sentry.addBreadcrumb({ message: 'Successfully connected to RabbitMQ' });
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to connect to RabbitMQ');
      } finally {
        span.end();
      }
    });
  }

  async close() {
    return Sentry.startSpan({ op: 'service', name: 'RabbitMQ Close Connection' }, async (span) => {
      try {
        Sentry.addBreadcrumb({ message: 'Closing RabbitMQ connection' });
        await this.channel.close();
        await this.connection.close();
        Sentry.addBreadcrumb({ message: 'RabbitMQ connection closed' });
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to close RabbitMQ connection');
      } finally {
        span.end();
      }
    });
  }

  async consumeMessages(callback: (msg: string) => void) {
    return Sentry.startSpan({ op: 'service', name: 'RabbitMQ Consume Messages' }, async (span) => {
      try {
        const queue = 'notification';
        Sentry.addBreadcrumb({ message: `Consuming messages from queue: ${queue}` });
        
        await this.channel.assertQueue(queue);
        this.channel.consume(queue, (msg) => {
          if (msg) {
            callback(msg.content.toString());
            this.channel.ack(msg);
            Sentry.addBreadcrumb({ message: `Message processed from queue: ${queue}` });
          }
        });
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to consume messages from RabbitMQ');
      } finally {
        span.end();
      }
    });
  }
}
