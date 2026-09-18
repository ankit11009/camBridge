import { createHash, randomBytes } from 'crypto';
import { BadRequestException, BadGatewayException, ServiceUnavailableException, GatewayTimeoutException } from '@nestjs/common';
import { CameraConnectionConfig } from '../camera-plugin.interface';

const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
const decodeXml = (value: string) =>
  value.replace(
    /&(lt|gt|quot|apos|amp);/g,
    (_, entity: string) =>
      ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[entity]!,
  );
const element = (xml: string, name: string) => {
  const match = xml.match(
    new RegExp(
      `<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`,
    ),
  );
  return match?.[1] || '';
};

/** ONVIF Profile S media negotiation with WS-Security UsernameToken digest. */
export async function getOnvifStreamUri(
  config: CameraConnectionConfig,
  signal: AbortSignal = AbortSignal.timeout(15000),
): Promise<string> {
  const deviceUrl = String(
    config.deviceUrl || config.xaddrs || config.address || '',
  )
    .trim()
    .split(/\s+/)[0];
  if (!deviceUrl)
    throw new BadRequestException(
      'ONVIF service address is missing. Open camera settings and enter its service URL, or add the camera using Scan Network.',
    );
  const call = async (
    url: string,
    namespace: string,
    operation: string,
    inner = '',
  ) => {
    if (!['http:', 'https:'].includes(new URL(url).protocol))
      throw new Error('Invalid ONVIF service URL');
    let security = '';
    if (config.username) {
      const nonce = randomBytes(20);
      const created = new Date().toISOString();
      const digest = createHash('sha1')
        .update(
          Buffer.concat([
            nonce,
            Buffer.from(created),
            Buffer.from(String(config.password || '')),
          ]),
        )
        .digest('base64');
      const wsse =
        'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';
      const profile =
        'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0';
      security = `<wsse:Security xmlns:wsse="${wsse}" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><wsse:UsernameToken><wsse:Username>${escapeXml(String(config.username))}</wsse:Username><wsse:Password Type="${profile}#PasswordDigest">${digest}</wsse:Password><wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString('base64')}</wsse:Nonce><wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security>`;
    }
    const request = {
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${namespace}/${operation}"`,
      },
      body: `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:t="http://www.onvif.org/ver10/schema"><s:Header>${security}</s:Header><s:Body><m:${operation} xmlns:m="${namespace}">${inner}</m:${operation}></s:Body></s:Envelope>`,
      signal,
    };
    const send = (authorization?: string) => fetch(url, { ...request, headers: { ...request.headers, ...(authorization ? { Authorization: authorization } : {}) } }).catch(() => {
      if (signal.aborted) throw new GatewayTimeoutException('Camera connection timed out after 15 seconds. The attempt was stopped.');
      throw new ServiceUnavailableException(`Cannot reach the camera's ONVIF ${operation} service. Check its address, power, and network connection.`);
    });
    let response = await send();
    // Many ONVIF cameras require HTTP Digest in addition to WS-Security.
    if (response.status === 401 && config.username) {
      const challenge = response.headers?.get('www-authenticate') || '';
      if (/^Digest\s/i.test(challenge)) {
        const params: Record<string, string> = {};
        for (const match of challenge.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g)) params[match[1].toLowerCase()] = match[2] ?? match[3];
        const algorithm = (params.algorithm || 'MD5').toUpperCase();
        const base = algorithm.replace('-SESS', '');
        if (!['MD5', 'SHA-256'].includes(base) || !params.nonce || params.realm === undefined)
          throw new BadGatewayException('Camera requested an unsupported HTTP Digest challenge.');
        const hash = (value: string) => createHash(base === 'MD5' ? 'md5' : 'sha256').update(value).digest('hex');
        const uri = new URL(url).pathname + new URL(url).search;
        const cnonce = randomBytes(16).toString('hex');
        const nc = '00000001';
        const qop = params.qop ? params.qop.split(',').map(v => v.trim()).find(v => v === 'auth') : undefined;
        if (params.qop && !qop) throw new BadGatewayException('Camera requires unsupported Digest quality of protection.');
        let ha1 = hash(`${config.username}:${params.realm}:${config.password || ''}`);
        if (algorithm.endsWith('-SESS')) ha1 = hash(`${ha1}:${params.nonce}:${cnonce}`);
        const digest = hash(`${ha1}:${params.nonce}:${qop ? `${nc}:${cnonce}:${qop}:` : ''}${hash(`POST:${uri}`)}`);
        const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        const fields = [`username=${quote(String(config.username))}`, `realm=${quote(params.realm)}`, `nonce=${quote(params.nonce)}`, `uri=${quote(uri)}`, `response=${quote(digest)}`, `algorithm=${algorithm}`];
        if (params.opaque) fields.push(`opaque=${quote(params.opaque)}`);
        if (qop) fields.push(`qop=auth`, `nc=${nc}`, `cnonce=${quote(cnonce)}`);
        else if (algorithm.endsWith('-SESS')) fields.push(`cnonce=${quote(cnonce)}`);
        await response.arrayBuffer();
        response = await send(`Digest ${fields.join(', ')}`);
      }
    }
    const xml = await response.text();
    if (response.status === 401 || response.status === 403 || /NotAuthorized/i.test(element(xml, 'Fault'))) {
      throw new BadRequestException(config.username
        ? 'Camera rejected the ONVIF credentials. Check the ONVIF username/password, account permissions, and camera time in camera settings.'
        : 'This camera requires ONVIF credentials. Enter its ONVIF username and password in camera settings, then reconnect.');
    }
    if (!response.ok || element(xml, 'Fault'))
      throw new BadGatewayException(
        `ONVIF ${operation} failed (HTTP ${response.status}). Check ONVIF credentials and camera time.`,
      );
    return xml;
  };
  const capabilities = await call(
    deviceUrl,
    'http://www.onvif.org/ver10/device/wsdl',
    'GetCapabilities',
    '<m:Category>Media</m:Category>',
  );
  const mediaUrl = decodeXml(
    element(element(capabilities, 'Media'), 'XAddr').trim(),
  );
  if (!mediaUrl)
    throw new BadGatewayException('Camera did not advertise an ONVIF Media service');
  const namespace = 'http://www.onvif.org/ver10/media/wsdl';
  const profiles = await call(mediaUrl, namespace, 'GetProfiles');
  const token =
    config.profileToken ||
    profiles.match(
      /<(?:[\w.-]+:)?Profiles\b[^>]*\btoken=["']([^"']+)["']/,
    )?.[1];
  if (!token) throw new BadGatewayException('Camera returned no ONVIF media profiles');
  const stream = await call(
    mediaUrl,
    namespace,
    'GetStreamUri',
    `<m:StreamSetup><t:Stream>RTP-Unicast</t:Stream><t:Transport><t:Protocol>RTSP</t:Protocol></t:Transport></m:StreamSetup><m:ProfileToken>${escapeXml(decodeXml(String(token)))}</m:ProfileToken>`,
  );
  const uri = decodeXml(element(stream, 'Uri').trim());
  if (!/^rtsps?:\/\//i.test(uri))
    throw new BadGatewayException('Camera returned no valid RTSP stream URI');
  return uri;
}
