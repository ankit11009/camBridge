import { isOriginAllowed } from './cors.config';

describe('CORS origin policy', () => {
  const dev = { NODE_ENV: 'development' };
  it.each([
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://[::1]:5173',
    'http://192.168.1.110:5173',
    'http://10.0.0.5:5173',
  ])('allows development origin %s', (origin) =>
    expect(isOriginAllowed(origin, dev)).toBe(true),
  );
  it.each([
    'null',
    'https://evil.example',
    'http://localhost.evil.example:5173',
    'ftp://localhost:5173',
  ])('rejects untrusted origin %s', (origin) =>
    expect(isOriginAllowed(origin, dev)).toBe(false),
  );
  it('restricts production to configured origins', () => {
    const env = {
      NODE_ENV: 'production',
      CORS_ORIGIN: ' https://app.example.com, http://localhost:5173 ',
    };
    expect(isOriginAllowed('https://app.example.com', env)).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', env)).toBe(true);
    expect(isOriginAllowed('http://localhost:5174', env)).toBe(false);
    expect(isOriginAllowed('http://192.168.1.110:5173', env)).toBe(false);
  });
});
