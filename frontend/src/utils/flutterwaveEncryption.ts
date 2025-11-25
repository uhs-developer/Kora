/**
 * Flutterwave Card Encryption Utility
 * 
 * IMPORTANT: Card details must be encrypted on the frontend before sending to backend.
 * 
 * This implementation uses AES-256-GCM encryption (Flutterwave's standard method).
 * The encryption key should be obtained from Flutterwave Dashboard → Settings → Developers → API Keys
 * 
 * The encryption key should be a 32-byte (256-bit) key, typically provided as a hex string.
 */

/**
 * Generate a random nonce for encryption
 * Flutterwave requires exactly 12 characters for card.nonce
 * The nonce should be a 12-character alphanumeric string (not base64)
 */
export function generateNonce(): string {
  // Flutterwave expects exactly 12 characters (not 12 bytes)
  // Generate 12 random alphanumeric characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const nonceArray = new Uint8Array(12);
  crypto.getRandomValues(nonceArray);
  
  let nonce = '';
  for (let i = 0; i < 12; i++) {
    nonce += chars[nonceArray[i] % chars.length];
  }
  
  return nonce;
}

/**
 * Convert encryption key to ArrayBuffer
 * Handles hex, base64, or raw string formats
 * Flutterwave encryption keys are typically base64-encoded 32-byte keys
 */
function keyToArrayBuffer(key: string): ArrayBuffer {
  // Remove any whitespace
  key = key.trim();
  
  // Try base64 format first (common for Flutterwave keys)
  // Base64 strings typically have length that's a multiple of 4
  // A 32-byte key encoded in base64 is 44 characters (32 * 4/3 = 42.67, rounded up)
  if (key.length % 4 === 0 || key.length === 44) {
    try {
      const binaryString = atob(key);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      // If decoded length is 32 bytes, this is likely the correct format
      if (bytes.length === 32) {
        return bytes.buffer;
      }
      // Otherwise, continue to try other formats
    } catch (e) {
      // Not valid base64, continue
    }
  }
  
  // Try hex format (even length, only hex characters)
  if (/^[0-9a-fA-F]+$/.test(key) && key.length % 2 === 0) {
    const bytes = new Uint8Array(key.length / 2);
    for (let i = 0; i < key.length; i += 2) {
      bytes[i / 2] = parseInt(key.substr(i, 2), 16);
    }
    return bytes.buffer;
  }
  
  // Treat as raw string - convert to UTF-8 bytes
  const encoder = new TextEncoder();
  return encoder.encode(key).buffer;
}

/**
 * Derive a 32-byte (256-bit) key from the encryption key
 * Flutterwave requires AES-256, so we ensure the key is exactly 32 bytes
 */
async function deriveAESKey(keyMaterial: ArrayBuffer): Promise<CryptoKey> {
  let keyBytes: ArrayBuffer;
  
  // If key is already 32 bytes, use it directly
  if (keyMaterial.byteLength === 32) {
    keyBytes = keyMaterial;
  } else if (keyMaterial.byteLength === 16) {
    // If 16 bytes, we need to derive 32 bytes for AES-256
    // Hash it to get 32 bytes
    keyBytes = await crypto.subtle.digest('SHA-256', keyMaterial);
  } else {
    // For any other length, hash to get consistent 32 bytes
    keyBytes = await crypto.subtle.digest('SHA-256', keyMaterial);
  }
  
  // Import as AES-256-GCM key
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
}

/**
 * Encrypt a string using AES-256-GCM (Flutterwave's standard)
 * 
 * @param plaintext - The text to encrypt
 * @param encryptionKey - Flutterwave encryption key (hex string, typically 64 hex chars = 32 bytes)
 * @param nonce - 12-character nonce string (sent to Flutterwave as-is)
 * @returns Base64 encoded encrypted string (ciphertext only, without IV/tag)
 */
async function encryptAES256(
  plaintext: string,
  encryptionKey: string,
  nonce: string
): Promise<string> {
  try {
    // Convert key to ArrayBuffer (handles multiple formats)
    const keyBuffer = keyToArrayBuffer(encryptionKey);
    
    // Derive a proper 32-byte AES-256 key
    const cryptoKey = await deriveAESKey(keyBuffer);
    
    // Convert the 12-character nonce string to 12 bytes for IV
    // We use the nonce string directly, converting each character to its byte value
    // This ensures we have exactly 12 bytes for AES-GCM IV
    const nonceBytes = new Uint8Array(12);
    const encoder = new TextEncoder();
    const nonceEncoded = encoder.encode(nonce);
    
    // Copy up to 12 bytes from the encoded nonce
    for (let i = 0; i < Math.min(12, nonceEncoded.length); i++) {
      nonceBytes[i] = nonceEncoded[i];
    }
    
    // If nonce is shorter than 12 bytes, pad with zeros (shouldn't happen, but safety check)
    if (nonceEncoded.length < 12) {
      for (let i = nonceEncoded.length; i < 12; i++) {
        nonceBytes[i] = 0;
      }
    }
    
    // Use the nonce as IV for AES-GCM (GCM uses 12-byte IV)
    const iv = nonceBytes;
    
    // Encrypt the plaintext using AES-GCM
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit authentication tag
      },
      cryptoKey,
      plaintextBytes
    );
    
    // AES-GCM output includes: ciphertext + authentication tag (16 bytes at the end)
    // Flutterwave expects just the ciphertext+tag as base64
    const encryptedArray = new Uint8Array(encrypted);
    const base64 = btoa(String.fromCharCode(...encryptedArray));
    
    return base64;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt card details: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Encrypt card details using Flutterwave encryption
 * 
 * @param cardNumber - Card number (with or without spaces)
 * @param expiryMonth - Expiry month (MM)
 * @param expiryYear - Expiry year (YY or YYYY)
 * @param cvv - CVV code
 * @param encryptionKey - Flutterwave encryption key from dashboard (hex string)
 * @returns Encrypted card details with nonce
 */
export async function encryptCardDetails(
  cardNumber: string,
  expiryMonth: string,
  expiryYear: string,
  cvv: string,
  encryptionKey: string
): Promise<{
  encrypted_card_number: string;
  encrypted_expiry_month: string;
  encrypted_expiry_year: string;
  encrypted_cvv: string;
  nonce: string;
}> {
  // Validate encryption key exists
  if (!encryptionKey || encryptionKey.trim().length === 0) {
    throw new Error('Encryption key is required. Please add VITE_FLUTTERWAVE_ENCRYPTION_KEY to your .env file.');
  }
  
  // Trim whitespace
  encryptionKey = encryptionKey.trim();
  
  // Log key format for debugging (first few chars only)
  let keyInfo: any = {
    length: encryptionKey.length,
    isHex: /^[0-9a-fA-F]+$/.test(encryptionKey),
    firstChars: encryptionKey.substring(0, 10) + '...',
  };
  
  // Try to decode base64 to check if it's valid
  try {
    const decoded = atob(encryptionKey);
    keyInfo.isBase64 = true;
    keyInfo.decodedLength = decoded.length;
    keyInfo.decodedBytes = decoded.length;
  } catch (e) {
    keyInfo.isBase64 = false;
  }
  
  console.log('Encryption key format check:', keyInfo);
  
  // Generate nonce
  const nonce = generateNonce();
  
  // Remove spaces and non-digits from card number
  const cleanCardNumber = cardNumber.replace(/\s+/g, '').replace(/\D/g, '');
  
  if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
    throw new Error('Invalid card number length');
  }
  
  // Normalize expiry year to 2 digits (Flutterwave expects YY format, e.g., "25" for 2025)
  let cleanExpiryYear = expiryYear.replace(/\D/g, '');
  if (cleanExpiryYear.length === 4) {
    // Convert YYYY to YY (e.g., "2025" -> "25")
    cleanExpiryYear = cleanExpiryYear.substring(2);
  } else if (cleanExpiryYear.length === 2) {
    // Already 2 digits, use as-is
    cleanExpiryYear = cleanExpiryYear;
  } else {
    throw new Error('Invalid expiry year format. Expected YY or YYYY.');
  }
  
  // Validate the 2-digit year is reasonable (00-99)
  const yearNum = parseInt(cleanExpiryYear);
  if (isNaN(yearNum) || yearNum < 0 || yearNum > 99) {
    throw new Error('Invalid expiry year');
  }
  
  // Normalize expiry month (ensure 2 digits)
  const cleanExpiryMonth = expiryMonth.replace(/\D/g, '').padStart(2, '0');
  
  if (parseInt(cleanExpiryMonth) < 1 || parseInt(cleanExpiryMonth) > 12) {
    throw new Error('Invalid expiry month');
  }
  
  // Validate CVV (3-4 digits)
  const cleanCvv = cvv.replace(/\D/g, '');
  if (cleanCvv.length < 3 || cleanCvv.length > 4) {
    throw new Error('Invalid CVV');
  }
  
  // Encrypt each field
  const [encryptedCardNumber, encryptedExpiryMonth, encryptedExpiryYear, encryptedCvv] = await Promise.all([
    encryptAES256(cleanCardNumber, encryptionKey, nonce),
    encryptAES256(cleanExpiryMonth, encryptionKey, nonce),
    encryptAES256(cleanExpiryYear, encryptionKey, nonce),
    encryptAES256(cleanCvv, encryptionKey, nonce),
  ]);
  
  return {
    encrypted_card_number: encryptedCardNumber,
    encrypted_expiry_month: encryptedExpiryMonth,
    encrypted_expiry_year: encryptedExpiryYear,
    encrypted_cvv: encryptedCvv,
    nonce: nonce,
  };
}

