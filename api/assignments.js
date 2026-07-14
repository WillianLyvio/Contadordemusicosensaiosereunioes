import {body, database, eventKey, fail, methodNotAllowed, send} from '../lib/server.js';

export default async function handler(request, response) {
  try {
    if (request.method !== 'POST') return methodNotAllowed(response);
    const input = body(request);
    const groups = Array.isArray(input.countGroups) ? input.countGroups.map(String) : [];
    if (!groups.length) return send(response, 200, {ok: true, conflicts: []});
    const sql = database();
    await sql`DELETE FROM group_assignments WHERE expires_at <= NOW()`;
    const key = eventKey(input.event || {});
    const conflicts = await sql.query(`
      SELECT ga.group_id AS "groupId", u.name AS "userName", ga.device_name AS "deviceName"
      FROM group_assignments ga JOIN users u ON u.id=ga.user_id
      WHERE ga.event_key=$1 AND ga.group_id=ANY($2::text[])
    `, [key, groups]);
    send(response, 200, {ok: true, conflicts});
  } catch (error) {
    fail(response, error);
  }
}
