import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { NotificationEvent, NotificationSetting, Tenant, Notification } from '../common/interfaces';
import * as Sentry from '@sentry/node';

interface DatabaseSchema {
  notificationevents: NotificationEvent;
  notificationsettings: NotificationSetting;
  tenants: Tenant;
  notifications: Notification;
}

@Injectable()
export class DatabaseService {
  private db: Kysely<DatabaseSchema>;

  constructor() {
    Sentry.startSpan({ op: 'service', name: 'DatabaseService Init' }, async (span) => {
      try {
        this.db = new Kysely<DatabaseSchema>({
          dialect: new PostgresDialect({
            pool: new Pool({
              connectionString: process.env.DATABASE_URL,
            }),
          }),
        });
        Sentry.addBreadcrumb({ message: 'Successfully connected to PostgreSQL' });
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to connect to PostgreSQL');
      } finally {
        span.end();
      }
    });
  }

  queryBuilder() {
    return Sentry.startSpan({ op: 'service', name: 'Database Query' }, (span) => {
      try {
        return this.db;
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to initialize query builder');
      } finally {
        span.end();
      }
    });
  }
}
