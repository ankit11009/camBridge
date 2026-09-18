import { getOnvifStreamUri } from './onvif-client';

describe('ONVIF media negotiation', () => {
  afterEach(() => jest.restoreAllMocks());
  it('negotiates the advertised media service, profile and escaped stream URI', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    for (const xml of [
      '<tt:Media><tt:XAddr>http://camera/media</tt:XAddr></tt:Media>',
      '<trt:Profiles fixed="true" token="main"/>',
      '<tt:Uri>rtsp://camera/vendor/stream?x=1&amp;y=2</tt:Uri>',
    ])
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => xml,
      } as Response);
    await expect(
      getOnvifStreamUri({
        deviceUrl: 'http://camera/device',
        username: 'admin',
        password: 'secret',
      }),
    ).resolves.toBe('rtsp://camera/vendor/stream?x=1&y=2');
    expect(fetchMock.mock.calls[1][0]).toBe('http://camera/media');
    expect(fetchMock.mock.calls[2][1]?.body).toContain(
      '<m:ProfileToken>main</m:ProfileToken>',
    );
    expect(fetchMock.mock.calls[0][1]?.body).toContain('PasswordDigest');
    expect(fetchMock.mock.calls[0][1]?.body).not.toContain('secret');
  });
  it('rejects SOAP faults without starting a guessed stream', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<s:Fault>NotAuthorized</s:Fault>',
      } as Response);
    await expect(
      getOnvifStreamUri({ address: 'http://camera/device' }),
    ).rejects.toThrow('requires ONVIF credentials');
  });
  it('returns actionable 400 when the camera requests missing credentials', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401, text: async () => '' } as Response);
    await expect(getOnvifStreamUri({ deviceUrl: 'http://camera/device' })).rejects.toMatchObject({ status: 400 });
  });
  it('reports rejected credentials without exposing the password', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401, text: async () => '' } as Response);
    await expect(getOnvifStreamUri({ deviceUrl: 'http://camera/device', username: 'operator', password: 'secret' })).rejects.toThrow('Camera rejected the ONVIF credentials');
  });
  it('reports unreachable cameras as 503', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch failed'));
    await expect(getOnvifStreamUri({ deviceUrl: 'http://camera/device' })).rejects.toMatchObject({ status: 503 });
  });

  it('aborts a stalled connection at the shared deadline', async () => {
    jest.useFakeTimers();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15000);
    jest.spyOn(global, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const result = expect(getOnvifStreamUri({ deviceUrl: 'http://camera/device' }, abort.signal)).rejects.toMatchObject({ status: 504 });
    await jest.advanceTimersByTimeAsync(15000);
    await result;
    clearTimeout(timer);
    jest.useRealTimers();
  });

});
