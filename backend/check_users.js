
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/database.sqlite');

db.all("SELECT id, email, role, company_id FROM users", (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Users:', JSON.stringify(rows, null, 2));
  db.close();
});
