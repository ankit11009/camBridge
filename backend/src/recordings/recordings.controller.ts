import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RecordingsService } from './recordings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import * as fs from 'fs';

@Controller()
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @Post('cameras/:id/recordings/start')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startRecording(
    @CurrentUser('userId') userId: string,
    @Param('id') cameraId: string,
  ) {
    return this.recordingsService.startRecording(userId, cameraId);
  }

  @Post('cameras/:id/recordings/stop')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async stopRecording(
    @CurrentUser('userId') userId: string,
    @Param('id') cameraId: string,
  ) {
    return this.recordingsService.stopRecording(userId, cameraId);
  }

  @Get('cameras/:id/recordings')
  @UseGuards(JwtAuthGuard)
  async listRecordings(
    @CurrentUser('userId') userId: string,
    @Param('id') cameraId: string,
  ) {
    return this.recordingsService.listRecordings(userId, cameraId);
  }

  /**
   * Serves MP4 video files with full HTTP 206 Partial Content Range support
   * for responsive video scrubbing and streaming in web browsers
   */
  @Get('recordings/:cameraId/:file')
  serveRecordingFile(
    @Param('cameraId') cameraId: string,
    @Param('file') file: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const filePath = this.recordingsService.getRecordingFilePath(
      cameraId,
      file,
    );
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException(`Recording clip '${file}' not found.`);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    if (range) {
      // Parse Range header e.g. "bytes=0-1024"
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE).send();
        return;
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);

      fileStream.pipe(res);
    } else {
      res.status(HttpStatus.OK);
      res.setHeader('Content-Length', fileSize);
      fs.createReadStream(filePath).pipe(res);
    }
  }
}
