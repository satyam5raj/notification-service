import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { DatabaseService } from '../database/database.service';

@Module({
  providers: [NotificationService, DatabaseService],
  controllers: [NotificationController]
})
export class NotificationModule {}
