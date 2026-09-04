const { Client } = require('pg');

async function run() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'mem_event_db',
    password: 'snx@AB123',
    port: 5432,
  });

  await client.connect();
  
  try {
    const res = await client.query(`SELECT * FROM "event_registration"`);
    console.log("Registrations:");
    console.table(res.rows);
  } catch(e) {
    console.error(e);
  }
  
  await client.end();
}

run().catch(console.error);
