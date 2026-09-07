import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PluginType, CameraStatus } from '@prisma/client';

describe('Cameras Plugin & Lifecycle (e2e)', () => {
  let app: INestApplication;

  const users: any[] = [];
  const cameras: any[] = [];

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
          id: `user-p3-${Date.now()}`,
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
          id: `cam-p3-${Date.now()}`,
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
        .mockImplementation(({ where }: { where: { ownerId?: string } }) => {
          return Promise.resolve(
            cameras.filter((c) => c.ownerId === where.ownerId),
          );
        }),
      findFirst: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { id?: string; ownerId?: string } }) => {
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
            const index = cameras.findIndex((c) => c.id === where.id);
            if (index === -1) return Promise.resolve(null);
            cameras[index] = {
              ...cameras[index],
              ...data,
              updatedAt: new Date(),
            };
            return Promise.resolve(cameras[index]);
          },
        ),
      delete: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => {
          const index = cameras.findIndex((c) => c.id === where.id);
          if (index === -1) return Promise.resolve(null);
          const [deleted] = cameras.splice(index, 1);
          return Promise.resolve(deleted);
        }),
    },
    event: {
      create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
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
    await app.close();
  });

  let accessToken: string;
  let cameraId: string;
  const testEmail = `plugin_user_${Date.now()}@cambridge.dev`;
  const testPassword = 'Password123!';

  beforeAll(async () => {
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: testEmail, password: testPassword })
      .expect(201);
    accessToken = regRes.body.accessToken;

    const camRes = await request(app.getHttpServer())
      .post('/cameras')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Mock Test Camera',
        pluginType: PluginType.MOCK,
        connectionConfig: { connectDelayMs: 20 },
      })
      .expect(201);
    cameraId = camRes.body.id;
  });

  it('GET /cameras/:id/status - returns initial status UNKNOWN', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cameras/${cameraId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(cameraId);
    expect(res.body.status).toBe('UNKNOWN');
  });

  it('POST /cameras/:id/connect - connects mock camera and transitions to CONNECTED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cameras/${cameraId}/connect`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(cameraId);
    expect(res.body.status).toBe('CONNECTED');
    expect(res.body.lastSeenAt).toBeDefined();
  });

  it('GET /cameras/:id/status - confirms CONNECTED status', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cameras/${cameraId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.status).toBe('CONNECTED');
  });

  it('POST /cameras/:id/disconnect - disconnects camera', async () => {
    const res = await request(app.getHttpServer())
      .post(`/cameras/${cameraId}/disconnect`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(cameraId);
    expect(res.body.status).toBe('DISCONNECTED');
  });

  it('rejects unauthenticated requests to connect and disconnect with 401', async () => {
    await request(app.getHttpServer())
      .post(`/cameras/${cameraId}/connect`)
      .expect(401);

    await request(app.getHttpServer())
      .post(`/cameras/${cameraId}/disconnect`)
      .expect(401);
  });
});
