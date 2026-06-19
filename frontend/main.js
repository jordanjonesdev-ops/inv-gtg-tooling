const authStatus = document.getElementById('auth-status');

function setToken(token) {
  if (token) {
    localStorage.setItem('invgtg_token', token);
    authStatus.textContent = 'Logged in';
  } else {
    localStorage.removeItem('invgtg_token');
    authStatus.textContent = 'Not logged in';
  }
}

function getToken() {
  return localStorage.getItem('invgtg_token');
}

async function apiFetch(path, opts = {}) {
  opts.headers = opts.headers || {};
  const token = getToken();
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, opts);
  if (res.status === 401) {
    setToken(null);
  }
  return res;
}

document.getElementById('register').addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const data = await res.json().catch(() => ({}));
  if (res.ok) alert('Registered'); else alert('Register failed: ' + (data.error || res.status));
});

document.getElementById('login').addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.token) {
    setToken(data.token);
    alert('Logged in');
  } else {
    alert('Login failed: ' + (data.error || res.status));
  }
});

document.getElementById('logout').addEventListener('click', () => {
  setToken(null);
  alert('Logged out');
});

document.getElementById('load').addEventListener('click', async () => {
  try {
    const res = await apiFetch('/api/players');
    const data = await res.json();
    const ul = document.getElementById('players');
    ul.innerHTML = '';
    (data || []).forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.id} - ${p.name} (${p.score})`;
      ul.appendChild(li);
    });
  } catch (err) {
    alert('Failed to load players: ' + err);
  }
});

// init
if (getToken()) authStatus.textContent = 'Logged in';
