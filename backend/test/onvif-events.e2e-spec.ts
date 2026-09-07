import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PluginType, CameraStatus, EventType } from '@prisma/client';
import { OnvifDiscoveryService } from '../src/plugins/onvif/onvif-discovery.service';

describe('ONVIF Discovery & Events Subsystem (e2e)', () => {
  let app: INestApplication;

  const users: any[] = [];
  const cameras: any[] = [];
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
          id: `user-p5-${Date.now()}`,
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
          id: `cam-p5-${Date.now()}`,
          ...data,
          status: CameraStatus.UNKNOWN,
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
    event: {
      create: jest.fn().mockImplementation(({ data }: { data: any }) => {
        const newEvent = {
          id: `event-p5-${Date.now()}-${Math.random()}`,
          ...data,
          createdAt: new Date(),
        };
        events.push(newEvent);
        return Promise.resolve(newEvent);
      }),
      findMany: jest
        .fn()
        .mockImplementation(
          ({
            where,
            take,
          }: {
            where: { cameraId: string; type?: EventType };
            take?: number;
          }) => {
            let matched = events.filter((e) => e.cameraId === where.cameraId);
            if (where.type) {
              matched = matched.filter((e) => e.type === where.type);
            }
            if (take) {
              matched = matched.slice(0, take);
            }
            return Promise.resolve(matched);
          },
        ),
    },
  };

  const mockOnvifDiscoveryService = {
    discover: jest.fn().mockResolvedValue([
      {
        id: 'onvif-device-test-1',
        name: 'Warehouse North Gate Cam',
        address: 'http://192.168.1.180:80/onvif/device_service',
        metadata: {
          hardware: 'Hikvision DS-2CD2042WD',
          scopes: ['onvif://www.onvif.org/name/Warehouse_North_Gate_Cam'],
          rtspUrl: 'rtsp://192.168.1.180:554/live/ch0',
        },
      },
    ]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(OnvifDiscoveryService)
      .useValue(mockOnvifDiscoveryService)
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

  it('authenticates a test user', async () => {
    const email = `onvif-user-${Date.now()}@example.com`;
    const password = 'Password123!';

    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    accessToken = regRes.body.accessToken;
    expect(accessToken).toBeDefined();
  });

  describe('GET /cameras/discover', () => {
    it('returns 401 if unauthenticated', async () => {
      await request(app.getHttpServer()).get('/cameras/discover').expect(401);
    });

    it('discovers network ONVIF cameras for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/cameras/discover')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].name).toBe('Warehouse North Gate Cam');
      expect(res.body[0].address).toBe(
        'http://192.168.1.180:80/onvif/device_service',
      );
    });
  });

  describe('Event Recording and History', () => {
    it('creates a test camera', async () => {
      const res = await request(app.getHttpServer())
        .post('/cameras')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Loading Dock Camera',
          pluginType: PluginType.MOCK,
          connectionConfig: { connectDelayMs: 10 },
        })
        .expect(201);

      cameraId = res.body.id;
      expect(cameraId).toBeDefined();
    });

    it('records STATUS event upon connecting', async () => {
      await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/connect`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify event was saved
      const evRes = await request(app.getHttpServer())
        .get(`/cameras/${cameraId}/events`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(evRes.body)).toBe(true);
      const statusEvent = evRes.body.find((e: any) => e.type === 'STATUS');
      expect(statusEvent).toBeDefined();
      expect(statusEvent.cameraId).toBe(cameraId);
    });

    it('triggers and records simulated MOTION event', async () => {
      const triggerRes = await request(app.getHttpServer())
        .post(`/cameras/${cameraId}/events/trigger`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'MOTION',
          payload: {
            zone: 'entry_gate',
            confidence: 0.98,
          },
        })
        .expect(200);

      expect(triggerRes.body).toBeDefined();
      expect(triggerRes.body.type).toBe('MOTION');
      expect(triggerRes.body.payload.zone).toBe('entry_gate');

      // Verify event query returns the motion event
      const motionEvents = await request(app.getHttpServer())
        .get(`/cameras/${cameraId}/events?type=MOTION`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(motionEvents.body.length).toBeGreaterThanOrEqual(1);
      expect(motionEvents.body[0].type).toBe('MOTION');
    });

    it('rejects unauthenticated requests to get events with 401', async () => {
      await request(app.getHttpServer())
        .get(`/cameras/${cameraId}/events`)
        .expect(401);
    });
  });
});
