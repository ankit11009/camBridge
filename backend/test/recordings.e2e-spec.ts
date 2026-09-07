import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PluginType, CameraStatus, RecordingTrigger } from '@prisma/client';
import * as path from 'path';

describe('Recordings & Video Capture (e2e)', () => {
  let app: INestApplication;

  const users: any[] = [];
  const cameras: any[] = [];
  const recordings: any[] = [];

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    isDatabaseHealthy: jest.fn().mockResolvedValue(true),
    user: {
      findUnique: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { email?: string; id?: string } }) => {
            if (where.email) {
              const emailTarget = where.email.toLowerCase();
              return Promise.resolve(
                users.find((u) => u.email === emailTarget) || null,
              );
            }
            if (where.id) {
              return Promise.resolve(
                users.find((u) => u.id === where.id) || null,
              );
            }
            return Promise.resolve(null);
          },
        ),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => {
        const newUser = {
          id: `user-rec-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.push(newUser);
        return Promise.resolve(newUser);
      }),
    },
    camera: {
      create: jest.fn().mockImplementation(({ data }: { data: any }) => {
        const newCamera = {
          id: `cam-rec-${Date.now()}`,
          ...data,
          status: CameraStatus.CONNECTED,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        cameras.push(newCamera);
        return Promise.resolve(newCamera);
      }),
      findMany: jest
        .fn()
        .mockImplementation(({ where }: { where: { ownerId: string } }) => {
          return Promise.resolve(
            cameras.filter((c) => c.ownerId === where.ownerId),
          );
        }),
      findFirst: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { id: string; ownerId: string } }) => {
            return Promise.resolve(
              cameras.find(
                (c) => c.id === where.id && c.ownerId === where.ownerId,
              ) || null,
            );
          },
        ),
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(
            cameras.find((c) => c.id === where.id) || null,
          );
        }),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: any }) => {
            const cam = cameras.find((c) => c.id === where.id);
            if (!cam) return Promise.resolve(null);
            Object.assign(cam, data);
            return Promise.resolve(cam);
          },
        ),
      delete: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => {
          const idx = cameras.findIndex((c) => c.id === where.id);
          if (idx !== -1) {
            const removed = cameras.splice(idx, 1)[0];
            return Promise.resolve(removed);
          }
          return Promise.resolve(null);
        }),
    },
    recording: {
      create: jest.fn().mockImplementation(({ data }: { data: any }) => {
        const newRecording = {
          id: `rec-db-${Date.now()}`,
          ...data,
          endedAt: null,
          createdAt: new Date(),
        };
        recordings.push(newRecording);
        return Promise.resolve(newRecording);
      }),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: any }) => {
            const rec = recordings.find((r) => r.id === where.id);
            if (!rec) return Promise.resolve(null);
            Object.assign(rec, data);
            return Promise.resolve(rec);
          },
        ),
      findMany: jest
        .fn()
        .mockImplementation(({ where }: { where: { cameraId: string } }) => {
          return Promise.resolve(
            recordings.filter((r) => r.cameraId === where.cameraId),
          );
        }),
    },
    event: {
      create: jest.fn().mockResolvedValue({ id: 'ev-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  let accessToken: string;
  let cameraId: string;
  let recordedFilename: string;

  it('authenticates user and creates a camera', async () => {
    const email = `rec-user-${Date.now()}@example.com`;
    const password = 'Password123!';

    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    accessToken = regRes.body.accessToken;

    const camRes = await request(app.getHttpServer())
      .post('/cameras')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Patio Camera',
        pluginType: PluginType.MOCK,
        connectionConfig: {},
      })
      .expect(201);

    cameraId = camRes.body.id;
    expect(cameraId).toBeDefined();
  });

  describe('Recording Lifecycle', () => {
    it('starts manual recording via POST /cameras/:id/recordings/start', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/recordings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.cameraId).toBe(cameraId);
      expect(res.body.trigger).toBe(RecordingTrigger.MANUAL);
      expect(res.body.videoUrl).toContain(`/recordings/${cameraId}/`);
    });

    it('rejects concurrent recording attempt with 400', async () => {
      await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/recordings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('stops active recording via POST /cameras/:id/recordings/stop', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/recordings/stop`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.finishedAt).toBeDefined();
      expect(res.body.duration).toBeGreaterThanOrEqual(1);

      recordedFilename = path.basename(res.body.filePath);
    });

    it('lists saved recordings via GET /cameras/:id/recordings', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cameras/${cameraId}/recordings`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].cameraId).toBe(cameraId);
    });

    it('serves recorded MP4 clip via GET /recordings/:cameraId/:file with range headers', async () => {
      const res = await request(app.getHttpServer())
        .get(`/recordings/${cameraId}/${recordedFilename}`)
        .set('Range', 'bytes=0-100')
        .expect(206);

      expect(res.headers['content-type']).toBe('video/mp4');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.headers['content-range']).toContain('bytes 0-100/');
    });

    it('automatically triggers a recording on simulated MOTION event', async () => {
      await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/events/trigger`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ type: 'MOTION' })
        .expect(200);

      // Allow microtask cycle for event recording trigger
      await new Promise((resolve) => setTimeout(resolve, 50));

      const listRes = await request(app.getHttpServer())
        .get(`/cameras/${cameraId}/recordings`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const eventRecording = listRes.body.find(
        (r: any) => r.trigger === RecordingTrigger.EVENT,
      );
      expect(eventRecording).toBeDefined();
      expect(eventRecording.cameraId).toBe(cameraId);
    });

    it('rejects unauthenticated recording endpoints with 401', async () => {
      await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/recordings/start`)
        .expect(401);

      await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/recordings/stop`)
        .expect(401);

      await request(app.getHttpServer())
        .get(`/cameras/${cameraId}/recordings`)
        .expect(401);
    });
  });
});
