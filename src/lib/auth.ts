import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const COOKIE_NAME = 'shareon_session';

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || 'shareon_default_fallback_secret_key_at_least_32_characters';
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(username: string): Promise<string> {
  const secretKey = getAuthSecret();
  return await new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<{ username: string } | null> {
  try {
    const secretKey = getAuthSecret();
    const { payload } = await jwtVerify(token, secretKey);
    if (payload && typeof payload.username === 'string') {
      return { username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export function validateCredentials(inputUser: string, inputPass: string): boolean {
  const expectedUser = process.env.AUTH_USERNAME;
  const expectedPass = process.env.AUTH_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return false;
  }

  const userBuffer = Buffer.from(inputUser);
  const expectedUserBuffer = Buffer.from(expectedUser);

  const passBuffer = Buffer.from(inputPass);
  const expectedPassBuffer = Buffer.from(expectedPass);

  const userMatch =
    userBuffer.length === expectedUserBuffer.length &&
    crypto.timingSafeEqual(userBuffer, expectedUserBuffer);

  const passMatch =
    passBuffer.length === expectedPassBuffer.length &&
    crypto.timingSafeEqual(passBuffer, expectedPassBuffer);

  return userMatch && passMatch;
}
