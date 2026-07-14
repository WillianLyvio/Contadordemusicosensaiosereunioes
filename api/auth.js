import bcrypt from 'bcryptjs';
import {
  body, createSession, database, fail, methodNotAllowed, publicUser,
  readSession, send, sessionCookie,
} from '../lib/server.js';

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      const user = readSession(request);
      send(response, 200, {ok: true, user: user ? publicUser(user) : null});
      return;
    }
    if (request.method === 'DELETE') {
      response.setHeader('Set-Cookie', 'contador_musicos_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
      send(response, 200, {ok: true});
      return;
    }
    if (request.method !== 'POST') return methodNotAllowed(response);

    const input = body(request);
    const username = String(input.username || '').trim().toLowerCase();
    const users = await database()`
      SELECT id, username, password_hash, name, role
      FROM users WHERE username = ${username} AND active = TRUE LIMIT 1
    `;
    const user = users[0];
    if (!user || !await bcrypt.compare(String(input.password || ''), user.password_hash)) {
      send(response, 401, {ok: false, message: 'Usuário ou senha inválidos.'});
      return;
    }
    const safeUser = publicUser(user);
    response.setHeader('Set-Cookie', sessionCookie(createSession(safeUser)));
    send(response, 200, {ok: true, user: safeUser});
  } catch (error) {
    fail(response, error);
  }
}
