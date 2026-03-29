import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not defined in environment variables');
  }
  // Ensure key is exactly 32 bytes
  return Buffer.from(key.padEnd(32, '0').slice(0, 32), 'utf8');
}

export function encrypt(text: string): string {
  if (!text) return text;
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  // Check if it looks like an encrypted string (has the iv:data format)
  if (!encryptedText.includes(':')) return encryptedText;
  try {
    const key = getKey();
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // If decryption fails, return the original text (might not be encrypted)
    return encryptedText;
  }
}

export function encryptIfDefined(text: string | null | undefined): string | null {
  if (text === null || text === undefined || text === '') return null;
  return encrypt(text);
}

export function decryptIfDefined(text: string | null | undefined): string | null {
  if (text === null || text === undefined || text === '') return null;
  return decrypt(text);
}
