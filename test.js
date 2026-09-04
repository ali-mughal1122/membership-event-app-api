const jwt = require('jsonwebtoken');
const axios = require('axios');

async function test() {
  const payload = {
    email: 'muslim@gmail.com',
    sub: 'd8ac52e8-d6f9-4aab-9277-1e23664a96c6',
    type: 'USER'
  };
  
  // same secret used in the app (default is usually 'secret' if not set in .env, let's check .env)
  // Wait, I will just run a curl request using a node script
  // Or better, let's just use the app's secret.
}
