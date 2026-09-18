import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PluginType, CameraStatus } from '@prisma/client';

describe('Auth & Camera CRUD (e2e)', () => {
  let app: INestApplication;

  // In-memory data store for e2e tests
  const users: any[] = [];
  const cameras: any[] = [];

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    isDatabaseHealthy: jest.fn().mockResolvedValue(true),
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
    event: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    recording: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
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
          id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
          id: `cam-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
  let refreshToken: string;
  let createdCameraId: string;
  const testEmail = `testuser_${Date.now()}@cambridge.dev`;
  const testPassword = 'Password123!';

  describe('Authentication flow', () => {
    it('POST /auth/register - registers new user and returns tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('POST /auth/register - rejects duplicate email with 409 Conflict', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(409);
    });

    it('POST /auth/login - authenticates user and returns fresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      accessToken = res.body.accessToken;
    });

    it('POST /auth/login - rejects invalid credentials with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('POST /auth/refresh - refreshes access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });

    it('GET /auth/me - returns authenticated user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testEmail.toLowerCase());
    });
  });

  describe('Camera Protected Routes & CRUD', () => {
    it('GET /cameras - rejects unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/cameras').expect(401);
    });

    it('POST /cameras - creates a new camera for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .post('/cameras')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Front Door Camera',
          pluginType: PluginType.MOCK,
          connectionConfig: { simulateIntervalMs: 2000 },
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Front Door Camera');
      expect(res.body.pluginType).toBe('MOCK');
      expect(res.body.connectionConfig).toEqual({ simulateIntervalMs: 2000 });

      createdCameraId = res.body.id;
    });

    it('GET /cameras - lists user cameras', async () => {
      const res = await request(app.getHttpServer())
        .get('/cameras')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const found = res.body.find((c: any) => c.id === createdCameraId);
      expect(found).toBeDefined();
      expect(found.name).toBe('Front Door Camera');
    });

    it('GET /cameras/:id - retrieves camera by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cameras/${createdCameraId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdCameraId);
      expect(res.body.name).toBe('Front Door Camera');
    });

    it('PATCH /cameras/:id - updates camera name', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/cameras/${createdCameraId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Main Entrance Camera',
        })
        .expect(200);

      expect(res.body.name).toBe('Main Entrance Camera');
    });

    it('DELETE /cameras/:id - deletes camera', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/cameras/${createdCameraId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify it is gone
      await request(app.getHttpServer())
        .get(`/cameras/${createdCameraId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
