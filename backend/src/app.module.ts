import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CamerasModule } from './cameras/cameras.module';
import { PluginManagerModule } from './plugins/plugin-manager.module';
import { EventsModule } from './events/events.module';
import { StreamingModule } from './streaming/streaming.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    PrismaModule,
    CryptoModule,
    UsersModule,
    AuthModule,
    StreamingModule,
    PluginManagerModule,
    EventsModule,
    CamerasModule,
    HealthModule,
  ],
})
export class AppModule {}
