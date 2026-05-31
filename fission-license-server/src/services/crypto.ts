import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

let privateKey: string;
let publicKey: string;

export interface LicensePayload {
  org_name: string;
  org_email: string;
  tier: string;
  max_users: number;
  max_incidents: number;
  features: string[];
  issued_at: string;
  expires_at: string;
  jti: string;
}

export function initCrypto(): void {
  const privPath = path.resolve(config.LICENSE_PRIVATE_KEY_PATH);
  const pubPath = path.resolve(config.LICENSE_PUBLIC_KEY_PATH);

  if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
    console.log('🔑 Generating RSA keypair...');
    const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const dir = path.dirname(privPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(privPath, priv, { mode: 0o600 });
    fs.writeFileSync(pubPath, pub, { mode: 0o644 });
    privateKey = priv;
    publicKey = pub;
    console.log('✅ RSA keypair generated');
  } else {
    privateKey = fs.readFileSync(privPath, 'utf8');
    publicKey = fs.readFileSync(pubPath, 'utf8');
    console.log('✅ RSA keys loaded');
  }
}

export function generateLicenseKey(payload: Omit<LicensePayload, 'jti'>): string {
  const jti = uuidv4();
  const token = jwt.sign({ ...payload, jti }, privateKey, {
    algorithm: 'RS256',
  });
  return token;
}

export function verifyLicenseKey(token: string): LicensePayload {
  const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
  return decoded as LicensePayload;
}

export function getPublicKey(): string {
  return publicKey;
}
