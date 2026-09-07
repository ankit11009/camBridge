import { Module } from '@nestjs/common';
import { PluginManagerService } from './plugin-manager.service';
import { StreamingModule } from '../streaming/streaming.module';
import { OnvifDiscoveryService } from './onvif/onvif-discovery.service';

@Module({
  imports: [StreamingModule],
  providers: [PluginManagerService, OnvifDiscoveryService],
  exports: [PluginManagerService, OnvifDiscoveryService],
})
export class PluginManagerModule {}
