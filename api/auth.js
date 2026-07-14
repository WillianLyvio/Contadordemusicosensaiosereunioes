import bcrypt from 'bcryptjs';
import {
  body, createSession, database, eventKey, fail, methodNotAllowed, publicUser,
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
      const session = readSession(request);
      if (session) await database()`DELETE FROM group_assignments WHERE user_id=${session.id}`;
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
    const groups = Array.isArray(input.countGroups)
      ? [...new Set(input.countGroups.map(String).filter((group) => /^[a-z0-9_]{2,40}$/.test(group)))]
      : [];
    const deviceId = String(input.deviceId || '').trim();
    if (user.role === 'contador' && (!groups.length || !deviceId)) {
      send(response, 400, {ok: false, message: 'Selecione ao menos um grupo para contagem.'});
      return;
    }
    if (groups.length && deviceId) {
      const sql = database();
      const key = eventKey(input.event || {});
      await sql`DELETE FROM group_assignments WHERE expires_at <= NOW()`;
      const conflicts = await sql.query(`
        SELECT ga.group_id AS "groupId", u.name AS "userName"
        FROM group_assignments ga JOIN users u ON u.id=ga.user_id
        WHERE ga.event_key=$1 AND ga.group_id=ANY($2::text[])
          AND NOT (ga.user_id=$3 AND ga.device_id=$4)
      `, [key, groups, user.id, deviceId]);
      if (conflicts.length) {
        send(response, 409, {
          ok: false,
          message: `Grupo(s) já em uso: ${conflicts.map((item) => `${item.groupId} (${item.userName})`).join(', ')}`,
          conflicts,
        });
        return;
      }
      await sql`DELETE FROM group_assignments WHERE user_id=${user.id} AND device_id=${deviceId} AND event_key=${key}`;
      for (const group of groups) {
        await sql.query(`
          INSERT INTO group_assignments (event_key,group_id,user_id,device_id,device_name,expires_at)
          VALUES ($1,$2,$3,$4,$5,NOW()+INTERVAL '5 minutes')
          ON CONFLICT (event_key,group_id) DO UPDATE SET
            user_id=EXCLUDED.user_id,device_id=EXCLUDED.device_id,device_name=EXCLUDED.device_name,
            expires_at=EXCLUDED.expires_at,updated_at=NOW()
        `, [key, group, user.id, deviceId, String(input.deviceName || '')]);
      }
    }
    const safeUser = publicUser(user);
    response.setHeader('Set-Cookie', sessionCookie(createSession(safeUser)));
    send(response, 200, {ok: true, user: safeUser});
  } catch (error) {
    fail(response, error);
  }
}
