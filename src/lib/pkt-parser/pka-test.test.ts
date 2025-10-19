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

    console.log('File size:', buffer.length);
    console.log(
      'First 20 bytes:',
      Array.from(buffer.slice(0, 20))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
    );

    const version = detectPacketTracerVersion(buffer);
    console.log('Detected version:', version);

    const xml =
      version === '5.x'
        ? decryptPacketTracer5(buffer)
        : decryptPacketTracer7(buffer);

    if (xml === null) {
      console.log('❌ Decryption returned null (authentication failed)');
    } else {
      console.log('✅ Decrypted successfully');
      console.log('XML length:', xml.length);
      console.log('First 500 chars:', xml.substring(0, 500));
      console.log('Contains PACKETTRACER:', xml.includes('<PACKETTRACER'));
      console.log(
        'Contains VERSION:',
        xml.includes('<VERSION>') || xml.includes('VERSION=')
      );
      console.log('Contains NETWORK:', xml.includes('<NETWORK'));
    }
  });
});
