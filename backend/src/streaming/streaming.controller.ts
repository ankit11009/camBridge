import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { StreamingService } from './streaming.service';

@Controller('streams')
export class StreamingController {
  private readonly logger = new Logger(StreamingController.name);

  constructor(private readonly streamingService: StreamingService) {}

  @Get(':cameraId/:file')
  getStreamFile(
    @Param('cameraId') cameraId: string,
    @Param('file') file: string,
    @Res() res: Response,
  ) {
    // Prevent directory traversal attacks
    const safeFileName = path.basename(file);
    const streamDir = this.streamingService.getStreamDirectory(cameraId);
    const filePath = path.join(streamDir, safeFileName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(
        `Stream file ${safeFileName} not found for camera ${cameraId}`,
      );
    }

    // Set CORS headers so HLS.js in browser can fetch segments cross-origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept',
    );

    if (safeFileName.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (safeFileName.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=10');
    }

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}
