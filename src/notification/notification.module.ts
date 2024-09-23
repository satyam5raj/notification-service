import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { DatabaseService } from '../database/database.service';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  providers: [NotificationService, DatabaseService],
  controllers: [NotificationController],
  imports: [RedisModule],
})
export class NotificationModule {}
