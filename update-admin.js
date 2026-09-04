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
  // Ensure the column exists before updating
  try {
    const res = await client.query(`UPDATE "user" SET "type" = 'ADMIN' WHERE email = 'admin@gmail.com'`);
    console.log(`Updated ${res.rowCount} row(s)`);
  } catch (e) {
    console.error(e);
  }
  await client.end();
}

run().catch(console.error);
