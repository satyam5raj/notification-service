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

  async set(key: string, value: any, ttl?: number) {
    return Sentry.startSpan({ op: 'service', name: 'Redis Set Key' }, async (span) => {
      try {
        const stringValue = JSON.stringify(value);
        Sentry.addBreadcrumb({ message: `Setting key: ${key} with TTL: ${ttl}` });

        if (ttl) {
          await this.redisClient.setex(key, ttl, stringValue);
        } else {
          await this.redisClient.set(key, stringValue);
        }

        Sentry.addBreadcrumb({ message: `Key set successfully: ${key}` });
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to set key in Redis');
      } finally {
        span.end();
      }
    });
  }

  async get(key: string): Promise<any> {
    return Sentry.startSpan({ op: 'service', name: 'Redis Get Key' }, async (span) => {
      try {
        Sentry.addBreadcrumb({ message: `Getting key: ${key}` });
        const value = await this.redisClient.get(key);
        const parsedValue = value ? JSON.parse(value) : null;
        Sentry.addBreadcrumb({ message: `Key retrieved: ${key}` });
        return parsedValue;
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to get key from Redis');
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
