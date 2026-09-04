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
    const res = await client.query(`SELECT * FROM "member"`);
    console.log("Members:");
    console.table(res.rows);
    
    const userRes = await client.query(`SELECT id, email, type FROM "user"`);
    console.log("Users:");
    console.table(userRes.rows);
  } catch(e) {
    console.error(e);
  }
  
  await client.end();
}

run().catch(console.error);
