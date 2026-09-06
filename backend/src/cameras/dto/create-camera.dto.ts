import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { PluginType } from '@prisma/client';

export class CreateCameraDto {
  @IsString({ message: 'Camera name must be a string' })
  @IsNotEmpty({ message: 'Camera name is required' })
  name!: string;

  @IsEnum(PluginType, {
    message: `Plugin type must be one of: ${Object.values(PluginType).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Plugin type is required' })
  pluginType!: PluginType;

  @IsObject({ message: 'Connection config must be an object' })
  @IsOptional()
  connectionConfig?: Record<string, unknown>;
}
