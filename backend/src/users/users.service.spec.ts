import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should hash the password with cost factor 12 and create user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const fakeCreatedUser = {
        id: 'user-uuid-1',
        email: 'test@cambridge.dev',
        passwordHash: 'hashed_pw',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.create.mockResolvedValue(fakeCreatedUser);

      const spyBcrypt = jest.spyOn(bcrypt, 'hash');

      const result = await service.createUser(
        'test@cambridge.dev',
        'password123',
      );

      expect(spyBcrypt).toHaveBeenCalledWith('password123', 12);
      expect(result.id).toBe('user-uuid-1');
      expect(result.email).toBe('test@cambridge.dev');
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should throw ConflictException if user already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.createUser('test@cambridge.dev', 'password123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return user without password if found', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@cambridge.dev',
        passwordHash: 'hash',
      });

      const user = await service.findById('user-1');
      expect(user.id).toBe('user-1');
      expect((user as any).passwordHash).toBeUndefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
