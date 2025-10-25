# Format de fichier Cisco Packet Tracer (.pkt/.pka)

Documentation technique pour le décryptage des fichiers Packet Tracer.

## Sources

- [ptexplorer](https://github.com/axcheron/ptexplorer) - Implémentation Python pour PT 5.x
- [pka2xml](https://github.com/mircodz/pka2xml) - Implémentation C++ pour PT 7+

---

## Vue d'ensemble

Les fichiers Packet Tracer sont des fichiers XML compressés et chiffrés :

- **`.pkt`** : Fichiers de simulation (contient `<PACKETTRACER5>`)
- **`.pka`** : Fichiers d'activités pédagogiques (contient `<PACKETTRACER5_ACTIVITY>`)

Le format de chiffrement a évolué entre les versions :

- **Packet Tracer 5.x** : Simple obfuscation XOR + compression zlib
- **Packet Tracer 7+** : Chiffrement TwoFish-EAX + double obfuscation + compression zlib

---

## Détection de la version

```typescript
function detectPacketTracerVersion(data: Uint8Array): '5.x' | '7+' {
  const length = data.length;

  // Après XOR simple, les bytes 4-5 doivent être les headers zlib (0x78, 0x9C)
  const byte4 = data[4] ^ (length - 4);
  const byte5 = data[5] ^ (length - 5);

  // Check for zlib magic bytes
  if (byte4 === 0x78 && (byte5 === 0x9c || byte5 === 0xda || byte5 === 0x01)) {
    return '5.x';
  }

  return '7+';
}
```

---

## Format Packet Tracer 5.x

### Algorithme de décryptage (2 étapes)

1. **XOR décroissant** : Chaque byte est XORé avec `(length - i)`
2. **Décompression zlib** : Les 4 premiers bytes (big-endian) = taille décompressée, le reste = données zlib

```typescript
function decryptPacketTracer5(data: Uint8Array): string {
  let length = data.length;
  const decrypted = new Uint8Array(length);

  // Étape 1 : XOR décroissant
  for (let i = 0; i < length; i++) {
    decrypted[i] = data[i] ^ (length - i);
  }

  // Étape 2 : Lire taille + décompresser zlib
  const uncompressedSize =
    (decrypted[0] << 24) |
    (decrypted[1] << 16) |
    (decrypted[2] << 8) |
    decrypted[3];

  const decompressed = pako.inflate(decrypted.slice(4));
  return new TextDecoder('utf-8').decode(decompressed);
}
```

---

## Format Packet Tracer 7+

### Algorithme de décryptage (4 étapes)

1. **Déobfuscation complexe** : Reverse byte order + XOR avec `(length - i * length)`
2. **Décryptage TwoFish-EAX** : Avec clés hardcodées
3. **Déobfuscation simple** : XOR avec `(length - i)`
4. **Décompression zlib** : Identique à PT 5.x

### Clés hardcodées

```typescript
// Trouvées par reverse-engineering du binaire Packet Tracer
const PT7_KEY = new Uint8Array(16).fill(137); // { 137, 137, ..., 137 }
const PT7_NONCE = new Uint8Array(16).fill(16); // { 16, 16, ..., 16 }
```

### Étape 1 : Déobfuscation initiale

```typescript
function deobfuscate1(input: Uint8Array): Uint8Array {
  const length = input.length;
  const output = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    const reverseIndex = length - i - 1;
    const xorKey = (length - i * length) & 0xff; // Overflow intentionnel
    output[i] = input[reverseIndex] ^ xorKey;
  }

  return output;
}
```

### Étape 2 : Décryptage TwoFish-EAX

- **Mode** : EAX (Encrypt-then-Authenticate-then-Translate)
- **Tag** : Les 16 derniers bytes après déobfuscation1
- **Implémentation** : Voir `src/features/network-diagram/lib/pkt-parser/crypto/`

```typescript
function decryptEAX(data: Uint8Array): Uint8Array | null {
  const cipher = new TwofishCipher(PT7_KEY);
  const ciphertext = data.slice(0, -16);
  const tag = data.slice(-16);

  // Retourne null si l'authentification échoue
  return eaxDecrypt(cipher, PT7_NONCE, ciphertext, tag);
}
```

### Étape 3 : Déobfuscation finale

```typescript
function deobfuscate2(input: Uint8Array): Uint8Array {
  const length = input.length;
  const output = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    output[i] = input[i] ^ (length - i);
  }

  return output;
}
```

### Étape 4 : Décompression zlib

Identique à PT 5.x (4 bytes taille + données zlib).

---

## Mode EAX - Implémentation

EAX = **Authenticated Encryption with Associated Data** (AEAD)

### Algorithme (simplifié)

```typescript
// Encryption
function eaxEncrypt(cipher, nonce, plaintext, header = []) {
  const nPrime = CMAC(cipher, [0x00...] + nonce);      // OMAC du nonce
  const hPrime = CMAC(cipher, [0x00...01] + header);   // OMAC du header
  const ciphertext = CTR(cipher, nPrime, plaintext);   // Chiffrement CTR
  const cPrime = CMAC(cipher, [0x00...02] + ciphertext); // OMAC du ciphertext
  const tag = nPrime XOR hPrime XOR cPrime;            // Tag final

  return { ciphertext, tag };
}

// Decryption
function eaxDecrypt(cipher, nonce, ciphertext, tag, header = []) {
  // Recalculer le tag attendu
  const nPrime = CMAC(cipher, [0x00...] + nonce);
  const hPrime = CMAC(cipher, [0x00...01] + header);
  const cPrime = CMAC(cipher, [0x00...02] + ciphertext);
  const expectedTag = nPrime XOR hPrime XOR cPrime;

  // Vérifier l'authentification
  if (tag !== expectedTag) return null;  // Authentification échouée

  // Déchiffrer
  return CTR(cipher, nPrime, ciphertext);
}
```

**Composants** :

- **CMAC** : Cipher-based MAC (RFC 4493) - voir `crypto/cmac.ts`
- **CTR** : Counter mode - voir `crypto/ctr.ts`
- **TwoFish** : Block cipher 128 bits - wrapper de `twofish-ts`

---

## Structure XML

### Fichier .pkt (simulation)

```xml
<PACKETTRACER5>
  <VERSION>7.3.0.0838</VERSION>
  <NETWORK>
    <DEVICES>
      <DEVICE>
        <ENGINE>
          <TYPE model="Router-PT-Empty">Router</TYPE>
          <NAME>Router1</NAME>
          <X>100</X>
          <Y>200</Y>
        </ENGINE>
      </DEVICE>
    </DEVICES>
    <LINKS>
      <LINK>
        <SOURCE>
          <DEVICE>Router1</DEVICE>
          <PORT>FastEthernet0/0</PORT>
        </SOURCE>
        <DESTINATION>
          <DEVICE>Switch0</DEVICE>
          <PORT>FastEthernet0/1</PORT>
        </DESTINATION>
      </LINK>
    </LINKS>
  </NETWORK>
</PACKETTRACER5>
```

### Fichier .pka (activité pédagogique)

```xml
<PACKETTRACER5_ACTIVITY>
  <VERSION>7.3.0.0838</VERSION>
  <PACKETTRACER5>
    <!-- Même structure que .pkt -->
  </PACKETTRACER5>
  <!-- Données supplémentaires : scoring, instructions, etc. -->
</PACKETTRACER5_ACTIVITY>
```

---

## Implémentation TypeScript

L'implémentation complète se trouve dans `src/features/network-diagram/lib/pkt-parser/` :

```
src/features/network-diagram/lib/pkt-parser/
├── crypto/
│   ├── types.ts          # Interfaces (BlockCipher, EAXResult)
│   ├── utils.ts          # XOR, concat, GF(2^128), etc.
│   ├── twofish.ts        # Wrapper TwoFish
│   ├── cmac.ts           # CMAC (RFC 4493)
│   ├── ctr.ts            # Counter mode
│   ├── eax.ts            # EAX mode
│   └── index.ts          # Exports publics
├── decoder-old.ts        # Décodeur PT 5.x
├── decoder.ts            # Décodeur PT 7+
└── index.ts              # API unifiée
```

### Usage

```typescript
import {
  decryptPacketTracer7,
  decryptPacketTracer5,
  detectPacketTracerVersion,
} from '@/features/network-diagram/lib/pkt-parser';

const fileData = await readFile('myfile.pkt');
const buffer = new Uint8Array(fileData);

const version = detectPacketTracerVersion(buffer);
const xml =
  version === '5.x'
    ? decryptPacketTracer5(buffer)
    : decryptPacketTracer7(buffer);

if (xml === null) {
  console.error('Decryption failed (authentication error)');
} else {
  console.log('XML:', xml);
}
```

## Dépendances

```json
{
  "dependencies": {
    "pako": "^2.1.0", // Décompression zlib
    "twofish-ts": "^1.0.0" // Cipher TwoFish
  }
}
```
