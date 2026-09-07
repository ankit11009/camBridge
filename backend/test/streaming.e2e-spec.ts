import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StreamingService } from '../src/streaming/streaming.service';

describe('Streaming & HLS Delivery (e2e)', () => {
  let app: INestApplication;
  let streamingService: StreamingService;
  const testCameraId = 'e2e-stream-test-camera';
  let testStreamDir: string;

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    isDatabaseHealthy: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    streamingService = moduleFixture.get<StreamingService>(StreamingService);
    testStreamDir = streamingService.getStreamDirectory(testCameraId);

    fs.mkdirSync(testStreamDir, { recursive: true });
    fs.writeFileSync(
      path.join(testStreamDir, 'stream.m3u8'),
      '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n',
    );
    fs.writeFileSync(
      path.join(testStreamDir, 'segment0.ts'),
      Buffer.from([0x47, 0x40, 0x00, 0x10]), // standard MPEG-TS sync byte 0x47
    );
  });

  afterAll(async () => {
    if (fs.existsSync(testStreamDir)) {
      try {
        fs.rmSync(testStreamDir, { recursive: true, force: true });
      } catch {}
    }
    await app.close();
  });

  it('GET /streams/:cameraId/:file - returns 404 for non-existent stream chunks', () => {
    return request(app.getHttpServer())
      .get(`/streams/${testCameraId}/non-existent.m3u8`)
      .expect(404);
  });

  it('GET /streams/:cameraId/stream.m3u8 - serves HLS playlist with correct MIME and CORS', () => {
    return request(app.getHttpServer())
      .get(`/streams/${testCameraId}/stream.m3u8`)
      .expect(200)
      .expect('Content-Type', /application\/vnd\.apple\.mpegurl/)
      .expect('Access-Control-Allow-Origin', '*')
      .expect((res) => {
        expect(res.text).toContain('#EXTM3U');
      });
  });

  it('GET /streams/:cameraId/segment0.ts - serves transport stream segment with video/mp2t', () => {
    return request(app.getHttpServer())
      .get(`/streams/${testCameraId}/segment0.ts`)
      .expect(200)
      .expect('Content-Type', 'video/mp2t')
      .expect('Access-Control-Allow-Origin', '*');
  });

  it('GET /streams/:cameraId/:file - blocks path traversal attempts using path.basename', () => {
    return request(app.getHttpServer())
      .get(`/streams/${testCameraId}/../../package.json`)
      .expect(404);
  });
});
