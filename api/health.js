import {database, fail, send} from '../lib/server.js';

export default async function handler(request, response) {
  try {
    await database()`SELECT 1`;
    send(response, 200, {ok: true, database: 'connected'});
  } catch (error) {
    fail(response, error);
  }
}
