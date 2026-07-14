import {body, database, eventKey, fail, methodNotAllowed, requireUser, send} from '../lib/server.js';

export default async function handler(request, response) {
  const user = requireUser(request, response);
  if (!user) return;
  try {
    const sql = database();
    if (request.method === 'POST') {
      const input = body(request);
      const event = input.event && typeof input.event === 'object' ? input.event : {};
      const deviceId = String(input.deviceId || '').trim();
      if (!deviceId || !event.date || !event.type) {
        send(response, 400, {ok: false, message: 'Evento ou aparelho inválido.'});
        return;
      }
      const key = eventKey(event);
      const counts = JSON.stringify(input.counts && typeof input.counts === 'object' ? input.counts : {});
      await sql.query(`
        WITH saved_event AS (
          INSERT INTO events
            (event_key, name, event_type, event_date, location, regional_leader, elder, region, created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (event_key) DO UPDATE SET
            name=EXCLUDED.name, location=EXCLUDED.location,
            regional_leader=EXCLUDED.regional_leader, elder=EXCLUDED.elder,
            region=EXCLUDED.region, updated_at=NOW()
          RETURNING id
        )
        INSERT INTO device_counts
          (event_id, device_id, device_name, counts, recorded_by, client_updated_at)
        SELECT id, $10, $11, $12::jsonb, $9, $13::timestamptz FROM saved_event
        ON CONFLICT (event_id, device_id) DO UPDATE SET
          device_name=EXCLUDED.device_name, counts=EXCLUDED.counts,
          recorded_by=EXCLUDED.recorded_by, client_updated_at=EXCLUDED.client_updated_at,
          updated_at=NOW()
      `, [
        key, String(event.name || 'Contagem de Músicos e Organistas'), String(event.type), String(event.date),
        String(event.local || ''), String(event.regionalLeader || ''), String(event.elder || ''),
        String(event.region || ''), user.id, deviceId, String(input.deviceName || ''), counts,
        String(input.updatedAt || new Date().toISOString()),
      ]);
      await sql.query(`
        UPDATE group_assignments SET expires_at=NOW()+INTERVAL '5 minutes', updated_at=NOW()
        WHERE event_key=$1 AND user_id=$2 AND device_id=$3
      `, [key, user.id, deviceId]);
      send(response, 200, {ok: true, eventKey: key});
      return;
    }
    if (request.method !== 'GET') return methodNotAllowed(response);
    const event = {
      name: request.query.name || '', type: request.query.type || '',
      date: request.query.date || '', local: request.query.local || '',
    };
    const key = eventKey(event);
    const devices = await sql`
      SELECT dc.device_id, dc.device_name, dc.counts, dc.client_updated_at,
             u.username, u.name AS user_name
      FROM device_counts dc
      JOIN events e ON e.id=dc.event_id
      LEFT JOIN users u ON u.id=dc.recorded_by
      WHERE e.event_key=${key}
      ORDER BY dc.updated_at DESC
    `;
    send(response, 200, {
      ok: true,
      eventKey: key,
      devices: devices.map((row) => ({
        deviceId: row.device_id, deviceName: row.device_name, counts: row.counts,
        updatedAt: row.client_updated_at, username: row.username, userName: row.user_name,
      })),
    });
  } catch (error) {
    fail(response, error);
  }
}
