import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CamerasModule } from './cameras/cameras.module';
import { PluginManagerModule } from './plugins/plugin-manager.module';
import { EventsModule } from './events/events.module';
import { StreamingModule } from './streaming/streaming.module';
import { RecordingsModule } from './recordings/recordings.module';
import { DetectionModule } from './detection/detection.module';
import { HealthModule } from './health/health.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60000),
          limit: config.get<number>('THROTTLE_LIMIT', 30),
        },
      ],
    }),
    PrismaModule,
    CryptoModule,
    UsersModule,
    AuthModule,
    StreamingModule,
    RecordingsModule,
    DetectionModule,
    PluginManagerModule,
    EventsModule,
    CamerasModule,
    HealthModule,
  ],
})
export class AppModule {}
