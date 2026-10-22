/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic PostgreSQL only; no production connection. */
const { PGlite } = require('@electric-sql/pglite');
const assert = require('node:assert/strict');
let checks=0;
const ok=(value,label)=>{assert.ok(value,label); console.log(++checks+'. '+label);};
(async()=>{
 const db=new PGlite();
 try {
  // Minimal fixture of previously audited FK actions, not a complete production schema.
  await db.exec(`CREATE SCHEMA auth;
    CREATE TABLE auth.users(id integer PRIMARY KEY);
    CREATE TABLE profiles(id integer PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE, username text, bio text);
    CREATE TABLE public_profiles(id integer PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE, username text);
    CREATE TABLE rooms(id integer PRIMARY KEY, created_by integer REFERENCES auth.users ON DELETE NO ACTION);
    CREATE TABLE room_members(id integer PRIMARY KEY, room_id integer REFERENCES rooms ON DELETE CASCADE,
      user_id integer REFERENCES auth.users ON DELETE CASCADE, approved_by integer REFERENCES auth.users ON DELETE NO ACTION);
    CREATE TABLE room_join_requests(id integer PRIMARY KEY, decided_by integer REFERENCES auth.users ON DELETE NO ACTION);
    CREATE TABLE posts(id integer PRIMARY KEY, room_id integer REFERENCES rooms ON DELETE CASCADE, username text);
    INSERT INTO auth.users VALUES(1),(2);
    INSERT INTO profiles VALUES(1,'original','bio'),(2,'other','bio');
    INSERT INTO public_profiles VALUES(1,'original'),(2,'other');
    INSERT INTO rooms VALUES(10,1);
    INSERT INTO room_members VALUES(20,10,2,1);
    INSERT INTO room_join_requests VALUES(30,1);
    INSERT INTO posts VALUES(40,10,'original');`);
  for(const sql of ["UPDATE profiles SET display_name='gone' WHERE id=1",
    "UPDATE profiles SET avatar_url=NULL WHERE id=1",
    "UPDATE profiles SET bio=NULL WHERE user_id=1"]) {
    await assert.rejects(db.query(sql),e=>e.code==='42703'); ok(true,'Legacy nonexistent column rejected');
  }
  const zero=await db.query("UPDATE profiles SET bio=NULL WHERE id=99 RETURNING id");
  ok(zero.rows.length===0,'Zero-row update can succeed without anonymizing any profile');

  // Two independent API operations: first transaction already committed.
  await db.query("UPDATE profiles SET bio=NULL WHERE id=1");
  await assert.rejects(db.query('DELETE FROM auth.users WHERE id=1'),e=>e.code==='23503');
  ok((await db.query('SELECT bio FROM profiles WHERE id=1')).rows[0].bio===null,
    'Auth FK failure does not undo earlier committed profile update');
  ok((await db.query('SELECT id FROM auth.users WHERE id=1')).rows.length===1,
    'Failed Auth deletion leaves account present');
  ok((await db.query('SELECT username FROM public_profiles WHERE id=1')).rows[0].username==='original' &&
     (await db.query('SELECT username FROM posts WHERE id=40')).rows[0].username==='original',
    'Profile-only change leaves separately stored attribution intact in fixture');

  // Demonstrate that removing just the creator reference is insufficient.
  await db.exec('BEGIN; UPDATE rooms SET created_by=2;');
  await assert.rejects(db.query('DELETE FROM auth.users WHERE id=1'),e=>e.code==='23503');
  await db.exec('ROLLBACK');
  ok(true,'Approval/decision references can still block deletion after creator handling');
  await db.exec('BEGIN; UPDATE rooms SET created_by=2; UPDATE room_members SET approved_by=2;');
  await assert.rejects(db.query('DELETE FROM auth.users WHERE id=1'),e=>e.code==='23503');
  await db.exec('ROLLBACK');
  ok(true,'Decision reference independently blocks deletion');

  await db.exec('BEGIN; DELETE FROM rooms WHERE id=10;');
  ok((await db.query('SELECT id FROM posts')).rows.length===0 &&
     (await db.query('SELECT id FROM room_members')).rows.length===0,
    'Deleting creator room to bypass FK would cascade other participant data');
  await db.exec('ROLLBACK');
  await db.exec('BEGIN; DELETE FROM auth.users WHERE id=2;');
  ok((await db.query('SELECT id FROM profiles WHERE id=2')).rows.length===0 &&
     (await db.query('SELECT id FROM public_profiles WHERE id=2')).rows.length===0 &&
     (await db.query('SELECT id FROM room_members WHERE user_id=2')).rows.length===0,
    'Unblocked Auth deletion cascades profile and membership fixture rows');
  await db.exec('ROLLBACK');
  console.log('Completed '+checks+' synthetic withdrawal DB checks. Auth HTTP, Storage, actual triggers and concurrent sessions are NOT simulated.');
 } finally { await db.close(); }
})().catch(()=>{console.error('Synthetic withdrawal DB check failed');process.exitCode=1;});

