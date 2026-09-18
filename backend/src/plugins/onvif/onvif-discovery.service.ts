import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { networkInterfaces } from 'os';
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
      if (!/<(?:[\w.-]+:)?ProbeMatch\b/.test(xml)) return null;
      xml = xml.match(/<(?:[\w.-]+:)?ProbeMatch\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?ProbeMatch>/)?.[0] || xml;
      // Extract XAddrs (service URL)
      const xaddrsMatch = xml.match(
        /<(?:[\w.-]+:)?XAddrs[^>]*>([^<]+)<\/(?:[\w.-]+:)?XAddrs>/i,
      );
      const xaddrs = xaddrsMatch ? xaddrsMatch[1].trim() : '';

      // Extract Endpoint Reference / Address
      const epMatch = xml.match(
        /<(?:[\w.-]+:)?Address[^>]*>([^<]+)<\/(?:[\w.-]+:)?Address>/i,
      );
      const epRef = epMatch ? epMatch[1].trim() : '';

      // Extract Scopes
      const scopesMatch = xml.match(
        /<(?:[\w.-]+:)?Scopes[^>]*>([^<]+)<\/(?:[\w.-]+:)?Scopes>/i,
      );
      const scopesStr = scopesMatch ? scopesMatch[1].trim() : '';
      const scopes = scopesStr ? scopesStr.split(/\s+/) : [];

      // Extract Types
      const typesMatch = xml.match(
        /<(?:[\w.-]+:)?Types[^>]*>([^<]+)<\/(?:[\w.-]+:)?Types>/i,
      );
      const types = typesMatch ? typesMatch[1].trim() : '';

      if (!xaddrs && !epRef && !senderAddress) {
        return null;
      }

      // First URL in XAddrs (space-separated if multiple)
      const primaryUrl =
        xaddrs.split(/\s+/).find((value) => {
          try { return ['http:', 'https:'].includes(new URL(value).protocol); }
          catch { return false; }
        }) ||
        (senderAddress ? `http://${senderAddress}/onvif/device_service` : '');

      // Parse human-readable name from scopes (e.g. onvif://www.onvif.org/name/Living_Room or onvif://www.onvif.org/hardware/ModelX)
      let name = '';
      let hardware = '';
      for (const scope of scopes) {
        let decoded = scope;
        try { decoded = decodeURIComponent(scope); } catch {}
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
        `onvif-${primaryUrl}`;

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
  async discover(timeoutMs = 5000, transport?: { address: string; target: string; port: number }): Promise<DiscoveredDevice[]> {
    const devices = new Map<string, DiscoveredDevice>();
    const addresses = transport ? [transport.address] : [...new Set(Object.values(networkInterfaces()).flat()
      .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
      .map((entry) => entry!.address))];
    if (!addresses.length) throw new ServiceUnavailableException('No active IPv4 network interface. Connect the backend computer to the camera network.');

    return new Promise((resolve, reject) => {
      const sockets: dgram.Socket[] = [];
      const retries: NodeJS.Timeout[] = [];
      let sent = false;
      let networkError = '';
      let finished = false;
      setTimeout(() => {
        finished = true;
        retries.forEach(clearTimeout);
        for (const socket of sockets) { try { socket.close(); } catch {} }
        if (!sent) reject(new ServiceUnavailableException(`ONVIF multicast discovery is unavailable${networkError ? ` (${networkError})` : ''}. Check local network permissions and multicast routing, or add the camera by its ONVIF address.`));
        else resolve([...devices.values()]);
      }, timeoutMs);
      for (const address of addresses) {
        try {
          const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
          sockets.push(socket);
          socket.on('error', (err) => this.logger.warn(`ONVIF discovery on ${address}: ${err.message}`));
          socket.on('message', (message, remote) => {
            if (finished) return;
            const matches = message.toString('utf8').match(/<(?:[\w.-]+:)?ProbeMatch\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?ProbeMatch>/g) || [];
            for (const xml of matches) {
              const device = this.parseProbeMatch(xml, remote.address);
              if (device) devices.set(device.id, device);
            }
          });
          socket.bind(0, address, () => {
            if (finished) return;
            try {
              socket.setMulticastInterface(address);
              socket.setMulticastTTL(2);
              socket.setMulticastLoopback(false);
              const probe = Buffer.from(this.createProbeMessage());
              const send = () => {
                if (finished) return;
                socket.send(probe, transport?.port || 3702, transport?.target || '239.255.255.250', (err) => {
                  if (!err) sent = true;
                  else {
                    networkError = (err as NodeJS.ErrnoException).code || 'network error';
                    this.logger.warn(`ONVIF probe send failed on ${address}: ${err.message}`);
                  }
                });
              };
              send();
              retries.push(setTimeout(send, Math.min(1000, timeoutMs / 2)));
            } catch (err) {
              this.logger.warn(`ONVIF multicast unavailable on ${address}: ${(err as Error).message}`);
            }
          });
        } catch (err) {
          this.logger.warn(`ONVIF discovery unavailable on ${address}: ${(err as Error).message}`);
        }
      }
    });
  }
}
