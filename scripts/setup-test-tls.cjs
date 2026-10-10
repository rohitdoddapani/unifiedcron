const { execFileSync } = require('node:child_process');
const { Client } = require('../packages/database/node_modules/pg');
const target = process.env.TEST_POSTGRES_CONTAINER;
const uri = process.env.TEST_DATABASE_URL;
if (!target || !uri || !new URL(uri).pathname.endsWith('_test')) throw new Error('An isolated test container/database is required');
const label = execFileSync('docker', ['inspect','--format','{{index .Config.Labels "unifiedcron.test"}}',target], {encoding:'utf8'}).trim();
if (label !== 'true') throw new Error('Refusing to modify a container without the unifiedcron.test label');
const cert = '/tmp/unifiedcron-test-ca.pem'; const key = '/tmp/unifiedcron-test-key.pem';
const hostname = new URL(uri).hostname;
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost',
  '-addext',`subjectAltName=DNS:localhost,IP:127.0.0.1,DNS:${hostname}`,'-keyout',key,'-out',cert],{stdio:'ignore'});
execFileSync('docker',['cp',cert,`${target}:${cert}`]);
execFileSync('docker',['cp',key,`${target}:${key}`]);
execFileSync('docker',['exec','-u','root',target,'sh','-c',`chown postgres:postgres ${cert} ${key} && chmod 600 ${key}`]);
(async()=>{
  const client = new Client({connectionString:uri}); await client.connect();
  try {
    await client.query("ALTER SYSTEM SET ssl_cert_file='/tmp/unifiedcron-test-ca.pem'");
    await client.query("ALTER SYSTEM SET ssl_key_file='/tmp/unifiedcron-test-key.pem'");
    await client.query("ALTER SYSTEM SET ssl='on'");
    await client.query('SELECT pg_reload_conf()');
    await new Promise(resolve=>setTimeout(resolve,1000));
    console.log('Isolated test PostgreSQL TLS configured');
  } finally { await client.end(); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
