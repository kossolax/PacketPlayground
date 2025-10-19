/**
 * Interface for block cipher implementations
 * Used to abstract different block ciphers (TwoFish, AES, etc.)
 */
export interface BlockCipher {
  /**
   * Encrypt a single block (16 bytes)
   */
  encrypt(block: Uint8Array): Uint8Array;

  /**
   * Decrypt a single block (16 bytes)
   */
  decrypt(block: Uint8Array): Uint8Array;

  /**
   * Block size in bytes (always 16 for TwoFish/AES)
   */
  readonly blockSize: number;
}

/**
 * Result of EAX encryption
 */
export interface EAXResult {
  /**
   * Encrypted ciphertext
   */
  ciphertext: Uint8Array;

  /**
   * Authentication tag (16 bytes)
   */
  tag: Uint8Array;
}

/**
 * Subkeys used in CMAC algorithm
 */
export interface CMACSubkeys {
  K1: Uint8Array;
  K2: Uint8Array;
}
