import bcrypt from 'bcryptjs';
import {body, database, fail, methodNotAllowed, requireUser, send} from '../lib/server.js';

export default async function handler(request, response) {
  const admin = requireUser(request, response, true);
  if (!admin) return;
  try {
    const sql = database();
    if (request.method === 'GET') {
      const users = await sql`SELECT id, username, name, role FROM users WHERE active = TRUE ORDER BY name, username`;
      send(response, 200, {ok: true, users: users.map((user) => ({...user, id: Number(user.id)}))});
      return;
    }
    if (request.method !== 'POST') return methodNotAllowed(response);
    const input = body(request);
    const username = String(input.username || '').trim().toLowerCase();
    if (input.action === 'delete') {
      if (username === admin.username) {
        send(response, 400, {ok: false, message: 'Não é possível excluir o usuário logado.'});
        return;
      }
      await sql`UPDATE users SET active = FALSE, updated_at = NOW() WHERE username = ${username}`;
      send(response, 200, {ok: true});
      return;
    }
    const original = String(input.originalUsername || username).trim().toLowerCase();
    const name = String(input.name || '').trim();
    const role = input.role === 'administrador' ? 'administrador' : 'contador';
    const password = String(input.password || '');
    if (!/^[a-z0-9._-]{3,80}$/.test(username) || !name) {
      send(response, 400, {ok: false, message: 'Dados do usuário inválidos.'});
      return;
    }
    const existing = await sql`SELECT id, password_hash FROM users WHERE username = ${original} LIMIT 1`;
    if (!existing[0] && !password) {
      send(response, 400, {ok: false, message: 'Informe a senha do novo usuário.'});
      return;
    }
    const hash = password ? await bcrypt.hash(password, 12) : existing[0].password_hash;
    if (existing[0]) {
      await sql`UPDATE users SET username=${username}, password_hash=${hash}, name=${name}, role=${role}, active=TRUE, updated_at=NOW() WHERE id=${existing[0].id}`;
    } else {
      await sql`INSERT INTO users (username, password_hash, name, role) VALUES (${username}, ${hash}, ${name}, ${role})`;
    }
    send(response, 200, {ok: true});
  } catch (error) {
    if (error.code === '23505') return send(response, 409, {ok: false, message: 'Já existe um usuário com este login.'});
    fail(response, error);
  }
}
