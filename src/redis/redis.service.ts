import { Injectable, OnModuleInit, OnModuleDestroy, InternalServerErrorException } from '@nestjs/common';
import Redis from 'ioredis';
import * as Sentry from '@sentry/node';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  async onModuleInit() {
    return Sentry.startSpan({ op: 'service', name: 'Redis Connect' }, async (span) => {
      try {
        Sentry.addBreadcrumb({ message: 'Connecting to Redis' });
        this.redisClient = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        });
        Sentry.addBreadcrumb({ message: 'Connected to Redis' });
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to connect to Redis');
      } finally {
        span.end();
      }
    });
  }

  async onModuleDestroy() {
    return Sentry.startSpan({ op: 'service', name: 'Redis Disconnect' }, async (span) => {
      try {
        Sentry.addBreadcrumb({ message: 'Disconnecting from Redis' });
        await this.redisClient.quit();
        Sentry.addBreadcrumb({ message: 'Disconnected from Redis' });
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to disconnect from Redis');
      } finally {
        span.end();
      }
    });
  }
}
