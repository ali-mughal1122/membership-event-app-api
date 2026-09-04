const jwt = require('jsonwebtoken');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im11c2xpbUBnbWFpbC5jb20iLCJzdWIiOiJkOGFjNTJlOC1kNmY5LTRhYWItOTI3Ny0xZTIzNjY0YTk2YzYiLCJ0eXBlIjoiVVNFUiIsImlhdCI6MTc4NjcxMTMzNiwiZXhwIjoxNzg2NzE0OTM2fQ.-C1lDfmbqidg8K3pwpvWM3RSqtcfXVgb5ILM_RwM7iU";

try {
  const decoded = jwt.decode(token);
  console.log("Decoded:", decoded);
  
  const now = Math.floor(Date.now() / 1000);
  console.log("Current time:", now);
  console.log("Is expired:", decoded.exp < now);
} catch (e) {
  console.error("Error", e);
}
