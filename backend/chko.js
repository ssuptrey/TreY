const { Pool } = require('pg');
async function main() {
    const p = new Pool({
        connectionString: 'postgresql://postgres.crkhtiuwxeznikxrqdnd:Guccigeng77@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
        ssl:{rejectUnauthorized:false}
    });
    const res = await p.query('SELECT u.email, o.id, o.title FROM obligations o JOIN obligation_owners oo ON o.id = oo.obligation_id JOIN users u ON oo.user_id = u.id');
    console.log(res.rows);
    p.end();
}
main();
