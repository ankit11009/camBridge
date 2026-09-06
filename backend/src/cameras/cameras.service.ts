import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { Camera, CameraStatus, Prisma } from '@prisma/client';

export interface FormattedCamera extends Omit<Camera, 'connectionConfig'> {
  connectionConfig: Record<string, unknown>;
}

@Injectable()
export class CamerasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateCameraDto): Promise<FormattedCamera> {
    const encryptedConfig = this.encryption.encryptConfig(dto.connectionConfig);

    const camera = await this.prisma.camera.create({
      data: {
        ownerId: userId,
        name: dto.name,
        pluginType: dto.pluginType,
        connectionConfig: encryptedConfig as Prisma.InputJsonValue,
        status: CameraStatus.UNKNOWN,
      },
    });

    return this.formatCamera(camera);
  }

  async findAll(userId: string): Promise<FormattedCamera[]> {
    const cameras = await this.prisma.camera.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return cameras.map((camera) => this.formatCamera(camera));
  }

  async findOne(userId: string, id: string): Promise<FormattedCamera> {
    const camera = await this.prisma.camera.findFirst({
      where: { id, ownerId: userId },
    });

    if (!camera) {
      throw new NotFoundException(`Camera with ID ${id} not found`);
    }

    return this.formatCamera(camera);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCameraDto,
  ): Promise<FormattedCamera> {
    // Verify existence and ownership
    await this.findOne(userId, id);

    const dataToUpdate: Prisma.CameraUpdateInput = {};

    if (dto.name !== undefined) {
      dataToUpdate.name = dto.name;
    }

    if (dto.connectionConfig !== undefined) {
      dataToUpdate.connectionConfig = this.encryption.encryptConfig(
        dto.connectionConfig,
      ) as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.camera.update({
      where: { id },
      data: dataToUpdate,
    });

    return this.formatCamera(updated);
  }

  async remove(
    userId: string,
    id: string,
  ): Promise<{ success: boolean; id: string }> {
    // Verify existence and ownership
    await this.findOne(userId, id);

    await this.prisma.camera.delete({
      where: { id },
    });

    return { success: true, id };
  }

  private formatCamera(camera: Camera): FormattedCamera {
    const decryptedConfig = this.encryption.decryptConfig(
      camera.connectionConfig as Record<string, unknown>,
    );

    return {
      ...camera,
      connectionConfig: decryptedConfig,
    };
  }
}
