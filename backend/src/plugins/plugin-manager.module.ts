import { Module } from '@nestjs/common';
import { PluginManagerService } from './plugin-manager.service';

@Module({
  providers: [PluginManagerService],
  exports: [PluginManagerService],
})
export class PluginManagerModule {}
