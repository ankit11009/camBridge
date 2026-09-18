import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function isOriginAllowed(origin: string, env = process.env): boolean {
  const configured = (env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return true;
  if (env.NODE_ENV === 'production') return false;

  // Local development includes Vite's fallback ports and LAN browser access.
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin)
      return false;
    const host = url.hostname;
    if (['localhost', '127.0.0.1', '[::1]'].includes(host)) return true;
    const octets = host.split('.').map(Number);
    if (
      octets.length !== 4 ||
      octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
    )
      return false;
    return (
      octets[0] === 10 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    );
  } catch {
    return false;
  }
}

export const corsOptions: CorsOptions = {
  // Read env at request time, after ConfigModule has loaded .env.
  origin: (origin, callback) =>
    callback(null, !origin || isOriginAllowed(origin)),
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
