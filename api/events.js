import {body, database, eventKey, fail, methodNotAllowed, requireUser, send} from '../lib/server.js';

const eventTypes = ['Reunião de encarregados e instrutores', 'Ensaio Regional', 'Exames musicais'];

export default async function handler(request, response) {
  const user = requireUser(request, response);
  if (!user) return;
  try {
    const sql = database();
    if (request.method === 'GET') {
      const date = String(request.query.date || '').trim();
      const upcoming = String(request.query.upcoming || '') === '1';
      const query = `
        SELECT e.id,e.event_key AS "eventKey",e.name,e.event_type AS type,e.event_date::text AS date,
               e.location AS local,e.regional_leader AS "regionalLeader",e.elder,e.region,
               e.created_at AS "createdAt",u.name AS "createdBy",COUNT(dc.id)::int AS "deviceCount"
        FROM events e LEFT JOIN users u ON u.id=e.created_by LEFT JOIN device_counts dc ON dc.event_id=e.id
        ${date ? 'WHERE e.event_date=$1' : (upcoming ? 'WHERE e.event_date >= CURRENT_DATE' : '')}
        GROUP BY e.id,u.name ORDER BY e.event_date ${upcoming ? 'ASC' : 'DESC'},e.created_at DESC`;
      const events = await sql.query(query, date ? [date] : []);
      send(response, 200, {ok: true, events});
      return;
    }
    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!['administrador', 'supervisor'].includes(user.role)) {
      send(response, 403, {ok: false, message: 'Somente Administrador ou Supervisor pode criar eventos.'});
      return;
    }
    const event = body(request).event || {};
    if (!event.name || !event.date || !eventTypes.includes(event.type)) {
      send(response, 400, {ok: false, message: 'Preencha nome, tipo e data do evento.'});
      return;
    }
    const key = eventKey(event);
    const saved = await sql`
      INSERT INTO events (event_key,name,event_type,event_date,location,regional_leader,elder,region,created_by)
      VALUES (${key},${String(event.name).trim()},${event.type},${event.date},${String(event.local||'').trim()},
              ${String(event.regionalLeader||'').trim()},${String(event.elder||'').trim()},${String(event.region||'').trim()},${user.id})
      ON CONFLICT (event_key) DO UPDATE SET name=EXCLUDED.name,location=EXCLUDED.location,
        regional_leader=EXCLUDED.regional_leader,elder=EXCLUDED.elder,region=EXCLUDED.region,updated_at=NOW()
      RETURNING id`;
    send(response, 200, {ok: true, eventKey: key, id: Number(saved[0].id)});
  } catch (error) {
    fail(response, error);
  }
}
