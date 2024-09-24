import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { DatabaseService } from '../database/database.service';
import { RedisModule } from 'src/redis/redis.module';
import { RabbitMQModule } from 'src/rabbitmq/rabbitmq.module';
import { NotificationConsumer } from './notification.consumer';

@Module({
  providers: [NotificationService, DatabaseService, NotificationConsumer],
  controllers: [NotificationController],
  imports: [RedisModule, RabbitMQModule],
})
export class NotificationModule {}
