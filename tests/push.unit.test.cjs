const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {verifyPushSignature,SupabasePushSchema}=require('../packages/shared/dist');
const {supabasePushSetupSql}=require('../packages/integrations/dist');
test('push authentication binds exact bytes and timestamp; rejects tampering and expiry',()=>{
 const key='a'.repeat(64),body=Buffer.from('{"version":1}'),now=Date.now(),stamp=String(Math.floor(now/1000));
 const sig=createHmac('sha256',Buffer.from(key,'hex')).update(stamp+'.').update(body).digest('hex');
 assert.equal(verifyPushSignature(body,stamp,sig,key,now),true);
 assert.equal(verifyPushSignature(Buffer.from('{}'),stamp,sig,key,now),false);
 assert.equal(verifyPushSignature(body,stamp,sig,key,now+301000),false);
 assert.equal(verifyPushSignature(body,stamp,sig,key,now-31000),false);
 assert.equal(verifyPushSignature(body,stamp,'bad',key,now),false);
});
test('push schema rejects commands/messages, excessive payloads and unsafe setup inputs',()=>{
 const p={version:1,projectRef:'a'.repeat(20),sequence:'1',lastRunId:'0',minimumRunId:null,backfill:false,jobs:[],runs:[]};
 assert.equal(SupabasePushSchema.safeParse(p).success,true);
 assert.equal(SupabasePushSchema.safeParse({...p,command:'secret'}).success,false);
 assert.equal(SupabasePushSchema.safeParse({...p,jobs:Array(1001).fill({jobid:'1',name:'n',schedule:'* * * * *',active:true})}).success,false);
 const args=['00000000-0000-0000-0000-000000000001','a'.repeat(20),'b'.repeat(64)];
 assert.throws(()=>supabasePushSetupSql(...args,'http://localhost/ingest'),/HTTPS/);
 const sql=supabasePushSetupSql(...args,'https://api.example.com/api/ingest/supabase/'+args[0]);
 assert.match(sql,/REVOKE ALL ON FUNCTION unifiedcron_push.send/);
 assert.match(sql,/ack\./);
 assert.doesNotMatch(sql,/SELECT.*command|return_message/);
});
