import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

test('authenticated community feed, profile, and post interactions', { timeout: 120_000 }, async () => {
  assert.ok(process.env.DATABASE_URL, 'Set DATABASE_URL to a test PostgreSQL database.');
  assert.ok(process.env.JWT_ACCESS_SECRET, 'Set JWT_ACCESS_SECRET in the environment.');

  const prefix = `feed_it_${randomBytes(6).toString('hex')}`;
  const userIds = [];
  let child;
  let api;

  async function createUser(key, role = 'user', options = {}) {
    const username = `${prefix}_${key}`;
    const user = (await pool.query(
      'INSERT INTO users(username,email,password_hash,first_name,last_name,is_active) VALUES($1,$2,$3,$4,$5,true) RETURNING id',
      [username, `${username}@example.test`, 'not-used', key, 'Test'],
    )).rows[0];
    userIds.push(user.id);
    const profile = (await pool.query(
      'INSERT INTO profiles(user_id,role,phone,location,pincode,interests) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [user.id, role, options.phone || '', options.location || '', options.pincode || '', options.interests || ''],
    )).rows[0];
    if (role === 'coach') {
      await pool.query('INSERT INTO coach_profiles(profile_id,sport) VALUES($1,$2)', [profile.id, options.sport || 'Football']);
    } else if (role === 'player') {
      await pool.query(
        'INSERT INTO player_profiles(profile_id,sport,district,state) VALUES($1,$2,$3,$4)',
        [profile.id, options.sport || 'Cricket', options.district || '', options.state || ''],
      );
    }
    return { id: user.id, username, role };
  }

  async function addPost(author, sport, content, createdAt = null) {
    const result = await pool.query(
      `INSERT INTO posts(author_id,content,sport,created_at)
       VALUES($1,$2,$3,COALESCE($4::timestamptz,NOW())) RETURNING id`,
      [author.id, `${prefix}:${content}`, sport, createdAt],
    );
    return result.rows[0].id;
  }

  async function connect(from, to) {
    await pool.query('INSERT INTO follows(follower_id,following_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [from.id, to.id]);
  }

  async function call(path, token, { method = 'GET', body } = {}) {
    const response = await fetch(`${api}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.status === 204 ? null : await response.json();
    assert.ok(response.ok, `${method} ${path} failed with ${response.status}: ${JSON.stringify(data)}`);
    return data;
  }

  try {
    const port = await availablePort();
    api = `http://127.0.0.1:${port}/api`;
    child = spawn(process.execPath, ['src/server.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
    });

    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Test API exited early with code ${child.exitCode}.`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        if (response.ok) { ready = true; break; }
      } catch {}
      await delay(250);
    }
    assert.ok(ready, 'Test API did not become ready.');

    const viewers = [
      await createUser('coach_viewer', 'coach', { phone: '9876543210', location: 'Test City', pincode: '123456', interests: 'Cricket, Basketball' }),
      await createUser('player_viewer', 'player', { location: 'Test City', pincode: '123456', interests: 'Basketball', district: 'North District', state: 'Test State' }),
      await createUser('general_viewer', 'user', { location: 'Test City', pincode: '123456', interests: 'Cricket, Football' }),
    ];
    const coach = await createUser('coach_author', 'coach', { location: 'Coach Town', pincode: '222222' });
    const athlete = await createUser('athlete_author', 'player', { location: 'Athlete Town', pincode: '333333', district: 'South District', state: 'Other State' });
    const general = await createUser('general_author', 'user', { location: 'General Town', pincode: '444444' });
    const generalNewer = await createUser('general_newer', 'user', { location: 'General Town', pincode: '444444' });
    const outsider = await createUser('outsider', 'user', { location: 'Far Town', pincode: '999999' });
    const pinAuthor = await createUser('pin_author', 'player', { pincode: '123456', district: 'Far District', state: 'Other State' });
    const localityAuthor = await createUser('locality_author', 'user', { location: 'test city', pincode: '888888' });
    const districtAuthor = await createUser('district_author', 'player', { pincode: '777777', district: 'North District', state: 'Other State' });
    const stateAuthor = await createUser('state_author', 'player', { pincode: '666666', district: 'Far District', state: 'Test State' });
    const remoteAuthor = await createUser('remote_author', 'player', { pincode: '555555', district: 'Far District', state: 'Other State' });
    const noPreferences = await createUser('no_preferences', 'user');

    const coachPost = await addPost(coach, 'Football', 'coach update');
    const athletePost = await addPost(athlete, 'Cricket', 'athlete update');
    const generalPost = await addPost(general, 'Basketball', 'general update');
    const newerGeneralPost = await addPost(generalNewer, 'Basketball', 'newer general update', new Date(Date.now() + 10_000).toISOString());
    const outsiderPost = await addPost(outsider, 'Cricket', 'unconnected update');
    const pinPost = await addPost(pinAuthor, 'Cricket', 'same pin update');
    const localityPost = await addPost(localityAuthor, 'Football', 'same locality update');
    const districtPost = await addPost(districtAuthor, 'Basketball', 'same district update');
    const statePost = await addPost(stateAuthor, 'Cricket', 'same state update');
    const remotePost = await addPost(remoteAuthor, 'Other', 'remote update');
    for (const viewer of viewers) {
      for (const author of [coach, athlete, general, generalNewer]) await connect(viewer, author);
    }
    for (const author of [coach, athlete, general, generalNewer]) await connect(author, viewers[0]);

    const tokens = viewers.map(viewer => jwt.sign(
      { id: viewer.id, username: viewer.username },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '10m' },
    ));

    for (const token of tokens) {
      const all = await call('/feed/?source=all&page=1&limit=50', token);
      const allIds = new Set(all.results.map(post => String(post.id)));
      for (const id of [coachPost, athletePost, generalPost, newerGeneralPost, outsiderPost, pinPost, localityPost, districtPost, statePost, remotePost]) {
        assert.ok(allIds.has(String(id)), 'All includes posts from connected and unrelated registered users.');
      }
      assert.deepEqual(
        new Set(all.results.filter(post => [coachPost, athletePost, generalPost].map(String).includes(String(post.id))).map(post => post.author.role)),
        new Set(['coach', 'player', 'user']),
      );
      assert.ok(all.results.find(post => String(post.id) === String(coachPost)).author.name);

      const sports = await call('/feed/?source=interest&page=1&limit=50', token);
      assert.ok(sports.results.some(post => [coachPost, athletePost, generalPost].map(String).includes(String(post.id))));
      assert.ok(sports.results.every(post => ['Cricket', 'Basketball', 'Football'].includes(post.sport)));

      const nearby = await call('/feed/?source=nearby&page=1&limit=50', token);
      assert.ok(nearby.results.some(post => String(post.id) === String(pinPost)));
      assert.ok(!nearby.results.some(post => String(post.id) === String(remotePost)));

      const connections = await call('/feed/?source=connections&page=1&limit=50', token);
      const connectedIds = connections.results.map(post => String(post.id));
      for (const id of [coachPost, athletePost, generalPost, newerGeneralPost]) assert.ok(connectedIds.includes(String(id)));
      for (const id of [outsiderPost, pinPost, localityPost, districtPost, statePost, remotePost]) assert.ok(!connectedIds.includes(String(id)));
    }

    const playerNearby = await call('/feed/?source=nearby&page=1&limit=50', tokens[1]);
    const nearbyIds = playerNearby.results.map(post => String(post.id));
    for (const id of [pinPost, localityPost, districtPost, statePost]) assert.ok(nearbyIds.includes(String(id)));
    assert.ok(!nearbyIds.includes(String(remotePost)));
    assert.deepEqual(nearbyIds.slice(0, 4), [pinPost, localityPost, districtPost, statePost].map(String));
    assert.ok((await call('/feed/?source=nearby&page=1&limit=50', tokens[0])).results.some(post => String(post.id) === String(pinPost)));

    const emptySports = await call('/feed/?source=interest', jwt.sign(
      { id: noPreferences.id, username: noPreferences.username },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '10m' },
    ));
    assert.equal(emptySports.results.length, 0);
    assert.match(emptySports.notice, /Select at least one sport/);
    const emptyNearby = await call('/feed/?source=nearby', jwt.sign(
      { id: noPreferences.id, username: noPreferences.username },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '10m' },
    ));
    assert.equal(emptyNearby.results.length, 0);
    assert.match(emptyNearby.notice, /Add your PIN code/);

    const initialRank = await call('/feed/?source=connections&page=1&limit=50', tokens[0]);
    const initialIds = initialRank.results.map(post => String(post.id));
    assert.ok(initialIds.indexOf(String(coachPost)) < initialIds.indexOf(String(athletePost)));
    assert.ok(initialIds.indexOf(String(athletePost)) < initialIds.indexOf(String(newerGeneralPost)));
    assert.ok(initialIds.indexOf(String(newerGeneralPost)) < initialIds.indexOf(String(generalPost)));

    const filler1 = await createUser('filler1');
    const filler2 = await createUser('filler2');
    const filler3 = await createUser('filler3');
    await connect(filler1, athlete);
    let ranked = await call('/feed/?source=connections&page=1&limit=50', tokens[0]);
    let rankedIds = ranked.results.map(post => String(post.id));
    assert.ok(rankedIds.indexOf(String(athletePost)) < rankedIds.indexOf(String(coachPost)), 'More connections outrank role priority.');
    await connect(filler2, general);
    ranked = await call('/feed/?source=connections&page=1&limit=50', tokens[0]);
    rankedIds = ranked.results.map(post => String(post.id));
    assert.ok(rankedIds.indexOf(String(athletePost)) < rankedIds.indexOf(String(generalPost)), 'Athlete wins a connection-count tie with a general user.');
    await connect(filler3, general);
    ranked = await call('/feed/?source=connections&page=1&limit=50', tokens[0]);
    rankedIds = ranked.results.map(post => String(post.id));
    assert.ok(rankedIds.indexOf(String(generalPost)) < rankedIds.indexOf(String(athletePost)), 'General user moves ahead after gaining more connections.');

    for (let index = 0; index < viewers.length; index += 1) {
      const token = tokens[index];
      const profile = await call('/me/', token);
      assert.equal(String(profile.user.id), String(viewers[index].id));
      const saved = await call('/me/', token, { method: 'PATCH', body: { location: `Updated City ${index}` } });
      assert.equal(saved.location, `Updated City ${index}`);
      const posts = await call(`/posts/?author=${coach.username}`, token);
      assert.ok(posts.some(post => String(post.id) === String(coachPost)));
      const like = await call(`/posts/${coachPost}/like/`, token, { method: 'POST' });
      assert.equal(like.liked, true);
      assert.equal(like.count, index + 1);
      const unliked = await call(`/posts/${coachPost}/like/`, token, { method: 'POST' });
      assert.equal(unliked.liked, false);
      assert.equal(unliked.count, index);
      const reliked = await call(`/posts/${coachPost}/like/`, token, { method: 'POST' });
      assert.equal(reliked.liked, true);
      assert.equal(reliked.count, index + 1);
      const comment = await call(`/posts/${coachPost}/comments/`, token, { method: 'POST', body: { text: `${prefix} comment ${index}` } });
      assert.ok(comment.id);
      const comments = await call(`/posts/${coachPost}/comments/`, token);
      assert.ok(comments.some(item => item.text === `${prefix} comment ${index}`));
    }

    const outsiderProfile = await call(`/users/${outsider.username}/`, tokens[0]);
    assert.equal(outsiderProfile.email, '');
    assert.equal(outsiderProfile.phone, '');
    assert.equal(outsiderProfile.is_following, false);
    const userSuggestions = await call(`/users/?q=${encodeURIComponent(outsider.username)}`, tokens[0]);
    assert.ok(userSuggestions.some(member => member.user.username === outsider.username));
    const ownProfile = await call(`/users/${viewers[0].username}/`, tokens[0]);
    assert.equal(ownProfile.phone, '9876543210');
    const followed = await call(`/users/${outsider.username}/follow/`, tokens[0], { method: 'POST' });
    assert.equal(followed.following, true);
    assert.equal((await call(`/users/${outsider.username}/`, tokens[0])).is_following, true);
    const unfollowed = await call(`/users/${outsider.username}/follow/`, tokens[0], { method: 'POST' });
    assert.equal(unfollowed.following, false);
    assert.equal(unfollowed.followers_count, 0);

    const published = await call('/posts/', tokens[0], { method: 'POST', body: { content: `${prefix} newly published`, sport: 'Cricket' } });
    const refreshedAll = await call('/feed/?source=all&page=1&limit=50', tokens[0]);
    assert.ok(refreshedAll.results.some(post => String(post.id) === String(published.id)));
    const firstPage = await call('/feed/?source=all&page=1&limit=2', tokens[0]);
    const secondPage = await call('/feed/?source=all&page=2&limit=2', tokens[0]);
    assert.equal(new Set([...firstPage.results, ...secondPage.results].map(post => String(post.id))).size, 4);

    await call(`/posts/${published.id}/comments/`, tokens[1], { method: 'POST', body: { text: `${prefix} deletion comment` } });
    await call(`/posts/${published.id}/like/`, tokens[1], { method: 'POST' });
    await call(`/posts/${published.id}/`, tokens[0], { method: 'DELETE' });
    assert.equal((await pool.query('SELECT 1 FROM posts WHERE id=$1', [published.id])).rowCount, 0);
    assert.equal((await pool.query('SELECT 1 FROM comments WHERE post_id=$1', [published.id])).rowCount, 0);
    assert.equal((await pool.query('SELECT 1 FROM likes WHERE post_id=$1', [published.id])).rowCount, 0);
    assert.equal((await pool.query('SELECT 1 FROM notifications WHERE link=$1', [`/posts/${published.id}`])).rowCount, 0);
    const afterDelete = await call('/posts/', tokens[1]);
    assert.ok(afterDelete.every(post => String(post.id) !== String(published.id)));
  } finally {
    if (userIds.length) await pool.query('DELETE FROM users WHERE id=ANY($1::bigint[])', [userIds]);
    if (child && child.exitCode === null) {
      child.kill();
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        delay(3000),
      ]);
    }
    await pool.end();
  }
});
