import { Module } from '@nestjs/common';
import { CamerasService } from './cameras.service';
import { CamerasController } from './cameras.controller';
import { PluginManagerModule } from '../plugins/plugin-manager.module';
import { EventsModule } from '../events/events.module';
import { RecordingsModule } from '../recordings/recordings.module';
import { ReconnectionService } from './reconnection.service';

@Module({
  imports: [PluginManagerModule, EventsModule, RecordingsModule],
  controllers: [CamerasController],
  providers: [CamerasService, ReconnectionService],
  exports: [CamerasService, ReconnectionService],
})
export class CamerasModule {}
