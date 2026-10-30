// End-to-end check of the rules through the real API — storage uploads,
// signed links behind the Community lock, and Delete account — the way the
// app's own client will hit them. Needs the local stack and the functions
// served:
//   npx supabase functions serve   (in another terminal)
//   npm run db:smoke
// It sets up its own two people and their era, and takes them away again
// at the end, so it runs on an empty database or a used one alike.
// The keys below are the fixed demo keys every local Supabase stack uses.
import { createClient } from '@supabase/supabase-js';
const URL = 'http://127.0.0.1:54321';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const opts = { auth: { persistSession: false } };
const svc = createClient(URL, SERVICE, opts);
const PASSWORD = 'smoke-test-pass-1';
const run = Date.now();
const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};
const client = async (name) => {
  const email = `${name}-${run}@smoke.test`;
  must(await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name } }));
  const c = createClient(URL, KEY, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return { c, id: data.user.id };
};
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
const up = (c, path) => c.storage.from('task-photos').upload(path, jpeg, { contentType: 'image/jpeg' });
let failures = 0;
const check = (ok, label) => { console.log(ok ? 'PASS' : 'FAIL', label); if (!ok) failures++; };
const membership = async (c, id) => (await c.from('membership_progress').select('*').eq('user_id', id).eq('status', 'active').single()).data;

// Mia and Julia, both on Day 3 of a three-task era, neither with a photo
// today yet — written as the service role, since joining shuts after Day 1.
const mia = await client('Mia');
const julia = await client('Julia');
const utcDay = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const era = must(await svc.from('challenges').insert({ name: `Smoke ${run}`, default_days: 10 }).select().single());
must(await svc.from('challenge_tasks').insert(
  ['Walk', 'Read', 'Stretch'].map((label, position) => ({ challenge_id: era.id, position, label })),
));
const round = must(await svc.from('rounds').insert({ challenge_id: era.id, start_date: utcDay(-2), days: 10 }).select().single());
must(await svc.from('memberships').insert([mia, julia].map((p) => ({ round_id: round.id, user_id: p.id }))));
const mm = await membership(mia.c, mia.id);
const jm = await membership(julia.c, julia.id);
const tasks = (await julia.c.from('challenge_tasks').select('id').eq('challenge_id', jm.challenge_id).order('position')).data.map((t) => t.id);

const miaPath = `${mia.id}/${mm.membership_id}/${mm.current_day}/smoke-${Date.now()}.jpg`;
const miaThumb = miaPath.replace('.jpg', '_thumb.jpg');
check(!(await up(mia.c, miaPath)).error, 'Mia uploads into her own today folder');
await up(mia.c, miaThumb);
check(!(await mia.c.rpc('complete_task', { task: tasks[0], photo_path: miaPath, thumb_path: miaThumb })).error, 'Mia records her photo');

check(!!(await julia.c.storage.from('task-photos').createSignedUrl(miaPath, 60)).error, "locked Julia gets no link to Mia's today photo");
check(!!(await up(julia.c, `${julia.id}/${jm.membership_id}/${jm.current_day - 1}/late.jpg`)).error, 'Julia cannot upload into yesterday');
check(!!(await up(julia.c, `${mia.id}/${mm.membership_id}/${mm.current_day}/x.jpg`)).error, "Julia cannot upload into Mia's folder");

const jp = `${julia.id}/${jm.membership_id}/${jm.current_day}/walk-${Date.now()}.jpg`;
const jt = jp.replace('.jpg', '_thumb.jpg');
await up(julia.c, jp);
await up(julia.c, jt);
check(!(await julia.c.rpc('complete_task', { task: tasks[2], photo_path: jp, thumb_path: jt, slot: 0 })).error, 'Julia completes a task with a photo');
const link = await julia.c.storage.from('task-photos').createSignedUrl(miaPath, 60);
check(!link.error && (await fetch(link.data.signedUrl)).status === 200, "unlocked, Julia's link to Mia's photo downloads");
const community = (await julia.c.rpc('community_today', { scope: 'members' })).data;
check(community?.length === 1 && community.every((r) => r.unlocked), 'Community reports the lock open');
check(!(await julia.c.from('reactions').insert({ membership_id: mm.membership_id, day: mm.current_day, user_id: julia.id, emoji: '🔥' })).error, "Julia reacts to Mia's today");
const undo = await julia.c.rpc('undo_task', { task: tasks[2] });
check(!undo.error && undo.data.length === 2, 'undo hands back both photo paths');
check(!(await julia.c.storage.from('task-photos').remove(undo.data)).error, 'Julia removes her own undone photos');

const anon = createClient(URL, KEY, opts);
check(((await anon.from('profiles').select('id')).data ?? []).length === 0, 'signed-out reads return nothing');
check(!!(await anon.rpc('round_standings', { rid: round.id })).error, "signed out, a round's standings are refused");

// The ways around the rules the 2026-10-30 audit found, through the API.
const dateIn = (timeZone) => new Date().toLocaleDateString('en-CA', { timeZone });
const farZone = dateIn('Pacific/Kiritimati') !== dateIn('UTC') ? 'Pacific/Kiritimati' : 'Pacific/Pago_Pago';
const moved = await mia.c.from('profiles').update({ timezone: farZone }).eq('id', mia.id);
check(moved.error?.code === 'P0001', 'in an era, a time zone that moves today is refused');
const ghost = `${mia.id}/${mm.membership_id}/${mm.current_day}/never-uploaded.jpg`;
check(!!(await mia.c.rpc('complete_task', { task: tasks[1], photo_path: ghost, thumb_path: ghost })).error,
  'a task photo that was never uploaded completes nothing');
check(!!(await julia.c.from('comments').insert({ membership_id: mm.membership_id, day: mm.current_day, author_id: julia.id, body: 'Old', created_at: '2000-01-01' })).error,
  'a comment cannot pick its own time');
const weak = await createClient(URL, KEY, opts).auth.signUp({ email: `weak${Date.now()}@test.dev`, password: 'short12' });
check(weak.error?.code === 'weak_password', 'a password under 8 characters is refused');

const temp = createClient(URL, KEY, opts);
const { data: su, error: suErr } = await temp.auth.signUp({ email: `gone${Date.now()}@test.dev`, password: 'throwaway-pass-1' });
if (suErr) throw suErr;
check(!(await temp.storage.from('avatars').upload(`${su.user.id}/face.jpg`, jpeg, { contentType: 'image/jpeg' })).error, 'new account uploads a face');
// Replacing a face removes the old file — storage only removes what the
// remover may also read, so this fails quietly without a read policy.
await temp.storage.from('avatars').upload(`${su.user.id}/old.jpg`, jpeg, { contentType: 'image/jpeg' });
const removed = await temp.storage.from('avatars').remove([`${su.user.id}/old.jpg`]);
check(!removed.error && removed.data?.length === 1, 'removing your own old face really removes it');
const del = await temp.functions.invoke('delete-account', { method: 'POST' });
check(!del.error, 'delete-account runs' + (del.error ? ': ' + del.error.message : ''));
check((await svc.auth.admin.getUserById(su.user.id)).error != null, 'the auth user is gone');
check(((await svc.storage.from('avatars').list(su.user.id)).data ?? []).length === 0, 'and their photos with it');
check(((await svc.from('profiles').select('id').eq('id', su.user.id)).data ?? []).length === 0, 'and their profile');

// Mia and Julia go the way delete-account takes anyone: photos, then the user.
for (const p of [mia, julia]) {
  const folder = `${p.id}/${p === mia ? mm.membership_id : jm.membership_id}`;
  const days = must(await svc.storage.from('task-photos').list(folder)).map((d) => `${folder}/${d.name}`);
  for (const day of days) {
    const files = must(await svc.storage.from('task-photos').list(day)).map((f) => `${day}/${f.name}`);
    if (files.length) must(await svc.storage.from('task-photos').remove(files));
  }
  must(await svc.auth.admin.deleteUser(p.id));
}
must(await svc.from('challenges').delete().eq('id', era.id));

console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
