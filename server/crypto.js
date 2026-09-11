const crypto = require('crypto');

// 32-byte encryption key (in production, loaded from environment secret)
const ENCRYPTION_KEY = process.env.PII_SECRET_KEY || crypto.createHash('sha256').update('back2you-secure-campus-2026-pii-secret').digest();
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function encryptPII(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptPII(encryptedText) {
  if (!encryptedText) return null;
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !encrypted) return null;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      ENCRYPTION_KEY,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

function computeHash(data) {
  return crypto.createHash('sha256').update(String(data)).digest('hex');
}

function createLogHash({ previousHash, itemId, action, actorId, timestamp, notes }) {
  const payload = `${previousHash || 'GENESIS'}|${itemId}|${action}|${actorId}|${timestamp}|${notes || ''}`;
  return computeHash(payload);
}

function hashSecret(secret) {
  if (!secret) return null;
  const normalized = String(secret).trim().toLowerCase();
  return computeHash(normalized);
}

module.exports = {
  encryptPII,
  decryptPII,
  computeHash,
  createLogHash,
  hashSecret
};
