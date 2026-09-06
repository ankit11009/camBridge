import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateCameraDto {
  @IsString({ message: 'Camera name must be a string' })
  @IsOptional()
  name?: string;

  @IsObject({ message: 'Connection config must be an object' })
  @IsOptional()
  connectionConfig?: Record<string, unknown>;
}
