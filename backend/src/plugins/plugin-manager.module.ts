import { Module } from '@nestjs/common';
import { PluginManagerService } from './plugin-manager.service';
import { StreamingModule } from '../streaming/streaming.module';

@Module({
  imports: [StreamingModule],
  providers: [PluginManagerService],
  exports: [PluginManagerService],
})
export class PluginManagerModule {}
