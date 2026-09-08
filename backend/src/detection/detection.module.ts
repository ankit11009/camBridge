import { Module } from '@nestjs/common';
import { DetectionService } from './detection.service';
import { DetectionController } from './detection.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [DetectionController],
  providers: [DetectionService],
  exports: [DetectionService],
})
export class DetectionModule {}
