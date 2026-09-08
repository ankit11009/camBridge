import {
  Controller,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DetectionService } from './detection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Post('cameras/:id/detect')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async detectCamera(
    @CurrentUser('userId') userId: string,
    @Param('id') cameraId: string,
  ) {
    return this.detectionService.analyzeCamera(userId, cameraId);
  }

  @Post('cameras/:id/recordings/:recordingId/detect')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async detectRecording(
    @CurrentUser('userId') userId: string,
    @Param('id') cameraId: string,
    @Param('recordingId') recordingId: string,
  ) {
    return this.detectionService.analyzeRecording(
      userId,
      cameraId,
      recordingId,
    );
  }
}
