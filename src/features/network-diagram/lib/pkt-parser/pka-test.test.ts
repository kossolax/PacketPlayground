import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { decryptPacketTracer7, detectPacketTracerVersion } from './decoder';
import { decryptPacketTracer5 } from './decoder-old';

describe('PKA file test', () => {
  it('should decode debug_connectivity.pka', () => {
    const filepath = join(
      import.meta.dirname,
      'samples',
      'debug_connectivity.pka'
    );
    const data = readFileSync(filepath);
    const buffer = new Uint8Array(data);

    const version = detectPacketTracerVersion(buffer);

    const xml =
      version === '5.x'
        ? decryptPacketTracer5(buffer)
        : decryptPacketTracer7(buffer);

    // Silent test - just verify it doesn't crash
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    xml;
  });
});
