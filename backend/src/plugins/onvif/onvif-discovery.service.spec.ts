import { Test, TestingModule } from '@nestjs/testing';
import { OnvifDiscoveryService } from './onvif-discovery.service';

describe('OnvifDiscoveryService', () => {
  let service: OnvifDiscoveryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnvifDiscoveryService],
    }).compile();

    service = module.get<OnvifDiscoveryService>(OnvifDiscoveryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProbeMessage', () => {
    it('creates standard WS-Discovery XML probe containing NetworkVideoTransmitter', () => {
      const probe = service.createProbeMessage('test-uuid-123');
      expect(probe).toContain(
        '<wsa:MessageID>urn:uuid:test-uuid-123</wsa:MessageID>',
      );
      expect(probe).toContain('<Types>dn:NetworkVideoTransmitter</Types>');
      expect(probe).toContain(
        'http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe',
      );
    });
  });

  describe('parseProbeMatch', () => {
    it('parses valid WS-Discovery ProbeMatches SOAP XML response', () => {
      const sampleXml = `
        <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">
          <s:Body>
            <d:ProbeMatches>
              <d:ProbeMatch>
                <wsa:EndpointReference>
                  <wsa:Address>urn:uuid:48696b76-6973-696f-6e00-112233445566</wsa:Address>
                </wsa:EndpointReference>
                <d:Types>dn:NetworkVideoTransmitter</d:Types>
                <d:Scopes>
                  onvif://www.onvif.org/type/video_encoder
                  onvif://www.onvif.org/hardware/DS-2CD2042WD-I
                  onvif://www.onvif.org/name/Driveway_Camera
                </d:Scopes>
                <d:XAddrs>http://192.168.1.120:80/onvif/device_service</d:XAddrs>
                <d:MetadataVersion>1</d:MetadataVersion>
              </d:ProbeMatch>
            </d:ProbeMatches>
          </s:Body>
        </s:Envelope>
      `;

      const device = service.parseProbeMatch(sampleXml, '192.168.1.120');
      expect(device).not.toBeNull();
      expect(device?.id).toBe('urn:uuid:48696b76-6973-696f-6e00-112233445566');
      expect(device?.name).toBe('Driveway Camera');
      expect(device?.address).toBe(
        'http://192.168.1.120:80/onvif/device_service',
      );
      expect(device?.metadata?.hardware).toBe('DS-2CD2042WD-I');
    });

    it('returns null if XML is empty or missing essential fields', () => {
      const device = service.parseProbeMatch('<empty></empty>');
      expect(device).toBeNull();
    });
  });

  describe('discover', () => {
    it('handles discovery timeout and returns array without unhandled errors', async () => {
      // Short timeout of 100ms for unit test
      const results = await service.discover(100);
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
