function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  // pad
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function hmacSign(key, data) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return base64UrlEncode(sig);
}

async function createToken(payloadObj, env, expiresInSeconds = 60 * 60 * 24) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = Object.assign({}, payloadObj, { exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const data = headerB64 + '.' + payloadB64;
  const sig = await hmacSign(env.AUTH_SECRET || 'dev_secret', data);
  return data + '.' + sig;
}

async function verifyToken(token, env) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sig] = parts;
    const data = headerB64 + '.' + payloadB64;
    const expected = await hmacSign(env.AUTH_SECRET || 'dev_secret', data);
    if (expected !== sig) return null;
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const pwKey = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, pwKey, 256);
  return base64UrlEncode(derived);
}

function randSalt(len = 16) {
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ----- Auth routes -----
    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').trim();
      const password = body.password || '';
      if (!username || !password) return new Response(JSON.stringify({ error: 'username and password required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      // check exists
      const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).all();
      if ((existing.results || []).length > 0) return new Response(JSON.stringify({ error: 'user exists' }), { status: 409, headers: { 'Content-Type': 'application/json' } });

      const salt = randSalt();
      const hash = await hashPassword(password, salt);
      await env.DB.prepare('INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)').bind(username, hash, salt, Date.now()).run();
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').trim();
      const password = body.password || '';
      if (!username || !password) return new Response(JSON.stringify({ error: 'username and password required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      const row = await env.DB.prepare('SELECT id, password_hash, salt FROM users WHERE username = ?').bind(username).all();
      const user = (row.results || [])[0];
      if (!user) return new Response(JSON.stringify({ error: 'invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      const hash = await hashPassword(password, user.salt);
      if (hash !== user.password_hash) return new Response(JSON.stringify({ error: 'invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

      const token = await createToken({ uid: user.id, username }, env, 60 * 60 * 24 * 7);
      return new Response(JSON.stringify({ token }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/auth/verify' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const match = auth.match(/^Bearer\s+(.+)$/i);
      if (!match) return new Response(JSON.stringify({ error: 'missing token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      const payload = await verifyToken(match[1], env);
      if (!payload) return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ valid: true, payload }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ----- Profile endpoints (protected) -----
    if (url.pathname === '/api/me/profile') {
      // verify token
      const auth = request.headers.get('Authorization') || '';
      const match = auth.match(/^Bearer\s+(.+)$/i);
      const token = match ? match[1] : null;
      const payload = token ? await verifyToken(token, env) : null;
      if (!payload) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT display_name, avatar_url, updated_at FROM profiles WHERE user_id = ?').bind(payload.uid).all();
        const profile = (row.results || [])[0] || null;
        return new Response(JSON.stringify({ profile }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (request.method === 'POST' || request.method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        const display_name = body.display_name ? String(body.display_name).slice(0, 100) : null;
        const avatar_url = body.avatar_url ? String(body.avatar_url).slice(0, 500) : null;
        const now = Date.now();
        // upsert by user_id
        await env.DB.prepare(
          'INSERT INTO profiles (user_id, display_name, avatar_url, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name, avatar_url=excluded.avatar_url, updated_at=excluded.updated_at'
        ).bind(payload.uid, display_name, avatar_url, now).run();
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    // ----- Existing players endpoints -----
    if (url.pathname === '/api/players' && request.method === 'GET') {
      const res = await env.DB.prepare('SELECT id, name, score FROM players ORDER BY score DESC').all();
      return new Response(JSON.stringify(res.results || []), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/players' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const name = body.name || 'anonymous';
      const score = Number(body.score || 0);
      const run = await env.DB.prepare('INSERT INTO players (name, score) VALUES (?, ?)').bind(name, score).run();
      return new Response(JSON.stringify({ success: true, result: run }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  }
};
