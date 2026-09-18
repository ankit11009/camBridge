import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DetectionService } from '../src/detection/detection.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PluginType, CameraStatus, RecordingTrigger } from '@prisma/client';

describe('AI Detection Subsystem (e2e)', () => {
  let app: INestApplication;

  const users: any[] = [];
  const cameras: any[] = [];
  const recordings: any[] = [];
  const events: any[] = [];

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
          id: `user-ai-${Date.now()}`,
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
          id: `cam-ai-${Date.now()}`,
          ...data,
          status: CameraStatus.CONNECTED,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        cameras.push(newCamera);
        return Promise.resolve(newCamera);
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
    },
    recording: {
      create: jest.fn().mockImplementation(({ data }: { data: any }) => {
        const newRec = {
          id: `rec-ai-${Date.now()}`,
          ...data,
          createdAt: new Date(),
        };
        recordings.push(newRec);
        return Promise.resolve(newRec);
      }),
      findFirst: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { id: string; cameraId: string } }) => {
            return Promise.resolve(
              recordings.find(
                (r) => r.id === where.id && r.cameraId === where.cameraId,
              ) || null,
            );
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
      create: jest.fn().mockImplementation(({ data }: { data: any }) => {
        const newEvent = {
          id: `event-ai-${Date.now()}-${Math.random()}`,
          ...data,
          createdAt: new Date(),
        };
        events.push(newEvent);
        return Promise.resolve(newEvent);
      }),
      findMany: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { cameraId: string; type?: string } }) => {
            return Promise.resolve(
              events.filter((e) => {
                if (e.cameraId !== where.cameraId) return false;
                if (where.type && e.type !== where.type) return false;
                return true;
              }),
            );
          },
        ),
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
    // Route/persistence tests use controlled inference; real image analysis is tested separately.
    jest
      .spyOn(app.get(DetectionService), 'runDetectionInference')
      .mockResolvedValue([
        {
          label: 'person',
          confidence: 0.9,
          box: { x: 10, y: 20, width: 100, height: 200 },
        },
      ]);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  let accessToken: string;
  let cameraId: string;
  let recordingId: string;

  it('authenticates user and sets up camera and recording', async () => {
    const email = `ai-user-${Date.now()}@example.com`;
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
        name: 'Driveway Camera',
        pluginType: PluginType.MOCK,
        connectionConfig: {},
      })
      .expect(201);

    cameraId = camRes.body.id;

    // Create a mock recording record directly
    const rec = await mockPrismaService.recording.create({
      data: {
        cameraId,
        filePath: '/tmp/driveway_rec.mp4',
        triggeredBy: RecordingTrigger.MANUAL,
        startedAt: new Date(),
      },
    });
    recordingId = rec.id;
  });

  describe('AI Inference Endpoints', () => {
    it('runs AI detection on live camera feed via POST /cameras/:id/detect', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/detect`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.type).toBe('DETECTION');
      expect(res.body.payload.source).toBe('live_frame');
      expect(Array.isArray(res.body.payload.detections)).toBe(true);

      const person = res.body.payload.detections.find(
        (d: any) => d.label === 'person',
      );
      expect(person).toBeDefined();
      expect(person.confidence).toBeGreaterThan(0.8);
      expect(person.box.width).toBeGreaterThan(0);
      expect(person.box.height).toBeGreaterThan(0);
    });

    it('runs AI detection on recorded video clip via POST /cameras/:id/recordings/:recId/detect', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/recordings/${recordingId}/detect`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.type).toBe('DETECTION');
      expect(res.body.payload.source).toBe('recording_clip');
      expect(res.body.payload.sourceId).toBe(recordingId);
    });

    it('filters events history by DETECTION type via GET /cameras/:id/events?type=DETECTION', async () => {
      // Also add a STATUS event to verify filtering works
      await mockPrismaService.event.create({
        data: {
          cameraId,
          type: 'STATUS',
          payload: { status: 'CONNECTED' },
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/cameras/${cameraId}/events?type=DETECTION`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body.every((ev: any) => ev.type === 'DETECTION')).toBe(true);
    });

    it('searches events by text query via GET /cameras/:id/events?search=person', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cameras/${cameraId}/events?search=person`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects unauthenticated detection requests with 401', async () => {
      await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/detect`)
        .expect(401);

      await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/recordings/${recordingId}/detect`)
        .expect(401);
    });
  });
});
