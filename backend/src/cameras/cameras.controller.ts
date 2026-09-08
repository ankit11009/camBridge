import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { EventType } from '@prisma/client';
import { CamerasService } from './cameras.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('cameras')
@UseGuards(JwtAuthGuard)
export class CamerasController {
  constructor(private readonly camerasService: CamerasService) {}

  @Post()
  async create(
    @CurrentUser('userId') userId: string,
    @Body() createCameraDto: CreateCameraDto,
  ) {
    return this.camerasService.create(userId, createCameraDto);
  }

  @Get()
  async findAll(@CurrentUser('userId') userId: string) {
    return this.camerasService.findAll(userId);
  }

  @Get('discover')
  async discover() {
    return this.camerasService.discoverCameras();
  }

  @Get(':id')
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.camerasService.findOne(userId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateCameraDto: UpdateCameraDto,
  ) {
    return this.camerasService.update(userId, id, updateCameraDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.camerasService.remove(userId, id);
  }

  @Post(':id/connect')
  @HttpCode(HttpStatus.OK)
  async connect(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.camerasService.connect(userId, id);
  }

  @Post(':id/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.camerasService.disconnect(userId, id);
  }

  @Get(':id/status')
  async getStatus(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.camerasService.getStatus(userId, id);
  }

  @Get(':id/stream')
  async getStream(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.camerasService.getStreamSource(userId, id);
  }

  @Get(':id/events')
  async getEvents(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('type') type?: EventType,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.camerasService.getCameraEvents(
      userId,
      id,
      limitNum,
      type,
      search,
      startDate,
      endDate,
    );
  }

  @Post(':id/events/trigger')
  @HttpCode(HttpStatus.OK)
  async triggerEvent(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() body: { type?: EventType; payload?: Record<string, any> },
  ) {
    return this.camerasService.triggerCameraEvent(
      userId,
      id,
      body?.type || 'MOTION',
      body?.payload,
    );
  }
}
