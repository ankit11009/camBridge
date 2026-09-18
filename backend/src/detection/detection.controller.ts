import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Min, Max, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DetectionService } from './detection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class MotionZoneDto {
  @IsNumber() @Min(0) @Max(1) x!: number;
  @IsNumber() @Min(0) @Max(1) y!: number;
  @IsNumber() @Min(0.001) @Max(1) width!: number;
  @IsNumber() @Min(0.001) @Max(1) height!: number;
}

class ToggleDetectionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MotionZoneDto)
  zone?: MotionZoneDto;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(30000)
  intervalMs?: number;
}

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

  @Post('cameras/:id/detection/toggle')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleDetection(
    @CurrentUser('userId') userId: string,
    @Param('id') cameraId: string,
    @Body() body: ToggleDetectionDto,
  ) {
    return this.detectionService.toggleDetectionMode(
      userId,
      cameraId,
      body.enabled,
      body.intervalMs,
      body.zone,
    );
  }

  @Get('cameras/:id/detection/status')
  @UseGuards(JwtAuthGuard)
  async getDetectionStatus(
    @CurrentUser('userId') userId: string,
    @Param('id') cameraId: string,
  ) {
    return this.detectionService.getDetectionStatus(userId, cameraId);
  }
}
