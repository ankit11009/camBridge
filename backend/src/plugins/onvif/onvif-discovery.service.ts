import { Injectable, Logger } from '@nestjs/common';
import * as dgram from 'dgram';
import { randomUUID } from 'crypto';
import { DiscoveredDevice } from '../camera-plugin.interface';

@Injectable()
export class OnvifDiscoveryService {
  private readonly logger = new Logger(OnvifDiscoveryService.name);

  /**
   * Generates a standard WS-Discovery SOAP Probe XML message
   */
  createProbeMessage(messageId: string = randomUUID()): string {
    return [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<Envelope xmlns:dn="http://www.onvif.org/ver10/network/wsdl" xmlns="http://www.w3.org/2003/05/soap-envelope">',
      '  <Header xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">',
      `    <wsa:MessageID>urn:uuid:${messageId}</wsa:MessageID>`,
      '    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>',
      '    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>',
      '  </Header>',
      '  <Body>',
      '    <Probe xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">',
      '      <Types>dn:NetworkVideoTransmitter</Types>',
      '      <Scopes />',
      '    </Probe>',
      '  </Body>',
      '</Envelope>',
    ].join('\n');
  }

  /**
   * Parses a WS-Discovery ProbeMatches SOAP XML response
   */
  parseProbeMatch(
    xml: string,
    senderAddress?: string,
  ): DiscoveredDevice | null {
    try {
      // Extract XAddrs (service URL)
      const xaddrsMatch = xml.match(
        /<[^:]*:?XAddrs[^>]*>([^<]+)<\/[^:]*:?XAddrs>/i,
      );
      const xaddrs = xaddrsMatch ? xaddrsMatch[1].trim() : '';

      // Extract Endpoint Reference / Address
      const epMatch = xml.match(
        /<[^:]*:?Address[^>]*>([^<]+)<\/[^:]*:?Address>/i,
      );
      const epRef = epMatch ? epMatch[1].trim() : '';

      // Extract Scopes
      const scopesMatch = xml.match(
        /<[^:]*:?Scopes[^>]*>([^<]+)<\/[^:]*:?Scopes>/i,
      );
      const scopesStr = scopesMatch ? scopesMatch[1].trim() : '';
      const scopes = scopesStr ? scopesStr.split(/\s+/) : [];

      // Extract Types
      const typesMatch = xml.match(
        /<[^:]*:?Types[^>]*>([^<]+)<\/[^:]*:?Types>/i,
      );
      const types = typesMatch ? typesMatch[1].trim() : '';

      if (!xaddrs && !epRef && !senderAddress) {
        return null;
      }

      // First URL in XAddrs (space-separated if multiple)
      const primaryUrl =
        xaddrs.split(/\s+/)[0] ||
        (senderAddress ? `http://${senderAddress}/onvif/device_service` : '');

      // Parse human-readable name from scopes (e.g. onvif://www.onvif.org/name/Living_Room or onvif://www.onvif.org/hardware/ModelX)
      let name = '';
      let hardware = '';
      for (const scope of scopes) {
        const decoded = decodeURIComponent(scope);
        if (decoded.includes('/name/')) {
          name = decoded.split('/name/').pop() || '';
        } else if (decoded.includes('/hardware/')) {
          hardware = decoded.split('/hardware/').pop() || '';
        }
      }

      if (!name) {
        try {
          const parsed = new URL(primaryUrl);
          name = `ONVIF Camera (${parsed.hostname})`;
        } catch {
          name = senderAddress
            ? `ONVIF Camera (${senderAddress})`
            : 'ONVIF Camera';
        }
      }

      const deviceId =
        epRef ||
        `onvif-${senderAddress || 'unknown'}-${randomUUID().substring(0, 8)}`;

      return {
        id: deviceId,
        name: name.replace(/_/g, ' '),
        address: primaryUrl,
        metadata: {
          xaddrs,
          types,
          scopes,
          hardware,
          discoveredAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      this.logger.warn(
        `Failed to parse ONVIF probe response: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Broadcasts WS-Discovery Probe to 239.255.255.250:3702 and gathers responses
   */
  async discover(timeoutMs = 2500): Promise<DiscoveredDevice[]> {
    const devices: Map<string, DiscoveredDevice> = new Map();
    const probe = this.createProbeMessage();

    return new Promise<DiscoveredDevice[]>((resolve) => {
      let socket: dgram.Socket | null = null;
      let timeoutHandle: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        if (socket) {
          try {
            socket.close();
          } catch {
            // Socket already closed
          }
          socket = null;
        }
      };

      try {
        socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        socket.on('error', (err) => {
          this.logger.warn(`ONVIF WS-Discovery socket error: ${err.message}`);
          cleanup();
          resolve(Array.from(devices.values()));
        });

        socket.on('message', (msg, rinfo) => {
          const xml = msg.toString('utf8');
          const device = this.parseProbeMatch(xml, rinfo.address);
          if (device) {
            this.logger.log(
              `Discovered ONVIF device: ${device.name} at ${device.address}`,
            );
            devices.set(device.address || device.id, device);
          }
        });

        socket.bind(0, () => {
          if (!socket) return;
          try {
            socket.setBroadcast(true);
            socket.setMulticastTTL(2);
            socket.setMulticastLoopback(true);

            const buf = Buffer.from(probe, 'utf8');
            socket.send(buf, 0, buf.length, 3702, '239.255.255.250', (err) => {
              if (err) {
                this.logger.warn(
                  `Failed to broadcast WS-Discovery probe: ${err.message}`,
                );
              }
            });
          } catch (err) {
            this.logger.warn(
              `Could not configure multicast broadcast: ${(err as Error).message}`,
            );
          }
        });

        timeoutHandle = setTimeout(() => {
          cleanup();

          const result = Array.from(devices.values());
          // If no devices found and mock discovery is requested or in development test mode
          if (
            result.length === 0 &&
            process.env.MOCK_ONVIF_DISCOVERY === 'true'
          ) {
            result.push({
              id: 'onvif-simulated-01',
              name: 'Simulated Office Cam (ONVIF)',
              address: 'http://192.168.1.150:80/onvif/device_service',
              metadata: {
                hardware: 'CamBridge-Virtual-ONVIF-1080p',
                types: 'dn:NetworkVideoTransmitter',
                scopes: ['onvif://www.onvif.org/name/Office_Cam'],
                rtspUrl: 'rtsp://192.168.1.150:554/live/ch0',
              },
            });
          }
          resolve(result);
        }, timeoutMs);
      } catch (err) {
        this.logger.warn(
          `Error initializing ONVIF discovery: ${(err as Error).message}`,
        );
        cleanup();
        resolve(Array.from(devices.values()));
      }
    });
  }
}
