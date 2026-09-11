import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { RedactionLoggingInterceptor } from './common/interceptors/redaction-logging.interceptor';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security: HTTP headers protection via Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:5173',
  );

  app.enableCors({
    origin: corsOrigin.includes(',')
      ? corsOrigin.split(',').map((o) => o.trim())
      : corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Security: Redact sensitive credentials in request logs
  app.useGlobalInterceptors(new RedactionLoggingInterceptor());

  await app.listen(port);
  logger.log(`CamBridge Backend is running on: http://localhost:${port}`);
  logger.log(`Health endpoint: http://localhost:${port}/health`);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap CamBridge backend:', err);
  process.exit(1);
});
