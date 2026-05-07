
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('backend/database.sqlite');

db.all("SELECT id, name, phone, company_id FROM contacts", (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Total contacts in DB:', rows.length);
  const companyCounts = {};
  rows.forEach(r => {
    const cid = String(r.company_id);
    companyCounts[cid] = (companyCounts[cid] || 0) + 1;
  });
  console.log('Company distribution:', JSON.stringify(companyCounts, null, 2));
  
  if (rows.length > 0) {
    console.log('First 5 contacts sample:', JSON.stringify(rows.slice(0, 5), null, 2));
  }
  db.close();
});
