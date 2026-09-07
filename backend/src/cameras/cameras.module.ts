import { Module } from '@nestjs/common';
import { CamerasService } from './cameras.service';
import { CamerasController } from './cameras.controller';
import { PluginManagerModule } from '../plugins/plugin-manager.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PluginManagerModule, EventsModule],
  controllers: [CamerasController],
  providers: [CamerasService],
  exports: [CamerasService],
})
export class CamerasModule {}
