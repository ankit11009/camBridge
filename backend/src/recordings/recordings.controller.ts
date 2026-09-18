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
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Range, Accept, Origin, Content-Type',
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Content-Length, Accept-Ranges',
    );
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    if (range) {
      // Parse Range header e.g. "bytes=0-1024" or "bytes=0-" or "bytes=-500"
      const parts = range.replace(/bytes=/, '').split('-');
      let start: number;
      let end: number;

      if (parts[0] === '' && parts[1] !== '') {
        // Suffix range e.g. "bytes=-500" (last 500 bytes)
        const suffixLength = parseInt(parts[1], 10);
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      } else {
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      }

      if (
        isNaN(start) ||
        isNaN(end) ||
        start < 0 ||
        start >= fileSize ||
        end >= fileSize ||
        start > end
      ) {
        res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        res.send();
        return;
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);

      fileStream.on('error', () => {
        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
        }
      });

      req.on('close', () => {
        fileStream.destroy();
      });

      fileStream.pipe(res);
    } else {
      res.status(HttpStatus.OK);
      res.setHeader('Content-Length', fileSize);
      const fileStream = fs.createReadStream(filePath);

      fileStream.on('error', () => {
        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).send();
        }
      });

      req.on('close', () => {
        fileStream.destroy();
      });

      fileStream.pipe(res);
    }
  }
}
