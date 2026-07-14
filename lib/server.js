import crypto from 'node:crypto';
import {neon} from '@neondatabase/serverless';

export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

export function send(response, status, payload) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

export function methodNotAllowed(response) {
  send(response, 405, {ok: false, message: 'Método não permitido.'});
}

export function body(request) {
  return request.body && typeof request.body === 'object' ? request.body : {};
}

function secret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET não configurado ou muito curto.');
  }
  return process.env.SESSION_SECRET;
}

function signature(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function createSession(user) {
  const encoded = Buffer.from(JSON.stringify({
    id: Number(user.id), username: user.username, name: user.name, role: user.role,
    expiresAt: Date.now() + (12 * 60 * 60 * 1000),
  })).toString('base64url');
  return `${encoded}.${signature(encoded)}`;
}

export function readSession(request) {
  const cookies = Object.fromEntries(String(request.headers.cookie || '').split(';')
    .map((part) => part.trim().split(/=(.*)/s).slice(0, 2))
    .filter(([key]) => key));
  const token = cookies.contador_musicos_session;
  if (!token) return null;
  const [encoded, suppliedSignature] = token.split('.');
  if (!encoded || !suppliedSignature) return null;
  const expected = signature(encoded);
  const supplied = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (supplied.length !== expectedBuffer.length || !crypto.timingSafeEqual(supplied, expectedBuffer)) return null;
  const user = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  return user.expiresAt > Date.now() ? user : null;
}

export function requireUser(request, response, admin = false) {
  const user = readSession(request);
  if (!user) {
    send(response, 401, {ok: false, message: 'Sessão expirada.'});
    return null;
  }
  if (admin && user.role !== 'administrador') {
    send(response, 403, {ok: false, message: 'Acesso permitido apenas para administrador.'});
    return null;
  }
  return user;
}

export function sessionCookie(token) {
  return `contador_musicos_session=${token}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`;
}

export function publicUser(user) {
  return {id: Number(user.id), username: user.username, name: user.name, role: user.role};
}

export function fail(response, error) {
  console.error(error);
  send(response, 503, {ok: false, message: 'Não foi possível acessar o banco de dados.'});
}

export function eventKey(event) {
  return crypto.createHash('sha256').update([
    event.date || '', event.type || '', event.name || '', event.local || '',
  ].map((value) => String(value).trim().toLowerCase()).join('|')).digest('hex');
}
