import { Module } from '@nestjs/common';
import { FfmpegService } from './ffmpeg.service';
import { StreamingService } from './streaming.service';
import { StreamingController } from './streaming.controller';

@Module({
  controllers: [StreamingController],
  providers: [FfmpegService, StreamingService],
  exports: [FfmpegService, StreamingService],
})
export class StreamingModule {}
