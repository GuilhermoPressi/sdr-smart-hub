
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/database.sqlite');

db.all("SELECT DISTINCT company_id FROM contacts", (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Distinct company_ids:', JSON.stringify(rows));
  
  db.all("SELECT company_id, COUNT(*) as count FROM contacts GROUP BY company_id", (err, counts) => {
    if (err) console.error(err);
    console.log('Counts:', JSON.stringify(counts));
    db.close();
  });
});
