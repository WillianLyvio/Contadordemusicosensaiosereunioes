import {body, database, eventKey, fail, methodNotAllowed, requireUser, send} from '../lib/server.js';

export default async function handler(request, response) {
  try {
    if (request.method !== 'POST') return methodNotAllowed(response);
    const input = body(request);
    const groups = Array.isArray(input.countGroups) ? input.countGroups.map(String) : [];
    if (!groups.length) return send(response, 200, {ok: true, conflicts: []});
    const sql = database();
    await sql`DELETE FROM group_assignments WHERE expires_at <= NOW()`;
    const key = eventKey(input.event || {});
    if (input.action === 'reserve') {
      const user = requireUser(request, response);
      if (!user) return;
      const deviceId = String(input.deviceId || '').trim();
      if (!groups.length || !deviceId) return send(response, 400, {ok: false, message: 'Selecione ao menos um grupo.'});
      const occupied = await sql.query(`SELECT ga.group_id AS "groupId",u.name AS "userName" FROM group_assignments ga JOIN users u ON u.id=ga.user_id WHERE ga.event_key=$1 AND ga.group_id=ANY($2::text[]) AND NOT(ga.user_id=$3 AND ga.device_id=$4)`, [key,groups,user.id,deviceId]);
      if (occupied.length) return send(response, 409, {ok:false,message:'Um ou mais grupos já estão em contagem.',conflicts:occupied});
      await sql`DELETE FROM group_assignments WHERE user_id=${user.id} AND device_id=${deviceId}`;
      for (const group of groups) await sql.query(`INSERT INTO group_assignments(event_key,group_id,user_id,device_id,device_name,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '5 minutes') ON CONFLICT(event_key,group_id) DO NOTHING`, [key,group,user.id,deviceId,String(input.deviceName||'')]);
      return send(response, 200, {ok:true});
    }
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
