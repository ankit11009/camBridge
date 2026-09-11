import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class RedactionLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl, body } = req;
    const startTime = Date.now();

    const sanitizedBody = this.sanitize(body);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `${method} ${originalUrl} ${duration}ms - Body: ${JSON.stringify(sanitizedBody)}`,
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          this.logger.warn(
            `${method} ${originalUrl} ${err.status || 500} ${duration}ms - Error: ${err.message}`,
          );
        },
      }),
    );
  }

  private sanitize(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    const sensitiveKeys = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'connectionConfig',
      'authorization',
    ];

    const copy: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (
        sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))
      ) {
        copy[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        copy[key] = this.sanitize(value);
      } else {
        copy[key] = value;
      }
    }
    return copy;
  }
}
