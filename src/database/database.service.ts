import { Injectable } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { NotificationEvent, NotificationSetting, Tenant, Notification } from '../common/interfaces';

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
    this.db = new Kysely<DatabaseSchema>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: process.env.DATABASE_URL,
        }),
      }),
    });
  }

  queryBuilder() {
    return this.db;
  }
}
