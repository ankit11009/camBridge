import * as http from 'http';
import * as dgram from 'dgram';
import { createHash } from 'crypto';
import { AddressInfo } from 'net';
import { OnvifDiscoveryService } from './onvif-discovery.service';
import { getOnvifStreamUri } from './onvif-client';

// Real socket demo camera: discovery, HTTP Digest, Media profiles, RTSP URI.
describe('Local demo ONVIF device', () => {
  let server: http.Server;
  let discovery: dgram.Socket;
  let endpoint: string;
  let authenticatedRequests = 0;
  const md5 = (s: string) => createHash('md5').update(s).digest('hex');
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const fields: Record<string, string> = {};
      for (const match of (req.headers.authorization || '').matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g)) fields[match[1]] = match[2] ?? match[3];
      const expected = md5(`${md5('demo:camera:demo-pass')}:demo-nonce:${fields.nc}:${fields.cnonce}:auth:${md5(`POST:${req.url}`)}`);
      if (fields.username !== 'demo' || fields.response !== expected) {
        res.writeHead(401, { 'WWW-Authenticate': 'Digest realm="camera", nonce="demo-nonce", qop="auth", algorithm=MD5' });
        res.end(); return;
      }
      authenticatedRequests++;
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const result = body.includes('GetCapabilities') ? `<tt:Media><tt:XAddr>${endpoint}/media</tt:XAddr></tt:Media>` :
          body.includes('GetProfiles') ? '<trt:Profiles token="main" />' : '<tt:Uri>rtsp://127.0.0.1:8554/demo</tt:Uri>';
        res.writeHead(200, { 'Content-Type': 'application/soap+xml' });
        res.end(`<s:Envelope><s:Body>${result}</s:Body></s:Envelope>`);
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    discovery = dgram.createSocket('udp4');
    await new Promise<void>(resolve => discovery.bind(0, '127.0.0.1', resolve));
    discovery.on('message', (_message, remote) => {
      const response = `<d:ProbeMatches><d:ProbeMatch><a:Address>urn:uuid:demo</a:Address><d:Scopes>onvif://www.onvif.org/name/Demo_Camera</d:Scopes><d:XAddrs>${endpoint}/device</d:XAddrs></d:ProbeMatch></d:ProbeMatches>`;
      discovery.send(Buffer.from(response), remote.port, remote.address);
    });
  });
  afterAll(async () => {
    discovery?.close();
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  });
  it('discovers the demo, authenticates, and resolves its advertised stream', async () => {
    const devices = await new OnvifDiscoveryService().discover(300, { address: '127.0.0.1', target: '127.0.0.1', port: (discovery.address() as AddressInfo).port });
    expect(devices).toHaveLength(1);
    expect(devices[0].name).toBe('Demo Camera');
    await expect(getOnvifStreamUri({ deviceUrl: devices[0].address, username: 'demo', password: 'demo-pass' })).resolves.toBe('rtsp://127.0.0.1:8554/demo');
    expect(authenticatedRequests).toBe(3);
  });
  it('rejects wrong credentials with an actionable error', async () => {
    await expect(getOnvifStreamUri({ deviceUrl: `${endpoint}/device`, username: 'demo', password: 'wrong' })).rejects.toThrow('Camera rejected');
  });
});
