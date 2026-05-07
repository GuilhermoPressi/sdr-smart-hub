
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/database.sqlite');

db.all("SELECT company_id, COUNT(*) as count FROM contacts GROUP BY company_id", (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
