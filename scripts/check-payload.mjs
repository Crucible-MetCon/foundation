import postgres from 'postgres';
const client = postgres('postgresql://postgres:RXwKWugaDmXWaWONrWNEMWIhIuMdyDTR@yamabiko.proxy.rlwy.net:57497/railway');
const rows = await client`SELECT raw_payload FROM pmx_trades WHERE raw_payload IS NOT NULL AND raw_payload != '' LIMIT 1`;
if (rows[0]) {
  const payload = JSON.parse(rows[0].raw_payload);
  for (const key of Object.keys(payload)) {
    console.log(key + ': ' + JSON.stringify(payload[key]));
  }
}
await client.end();
