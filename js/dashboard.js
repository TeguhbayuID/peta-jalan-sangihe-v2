const icons = {
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>`,
  printer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-5a1 1 0 011-1h16a1 1 0 011 1v5a1 1 0 01-1 1h-2M6 14h12v7H6z"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>`
};

function tile(href, iconKey, label, kategori) {
  return `<a href="${href}" class="menu-tile tile-${kategori}">
    <span class="icon-wrap">${icons[iconKey]}</span>
    <span class="label">${label}</span>
  </a>`;
}

async function checkSessionAndRole() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const userInfo = document.getElementById('userInfo');
  const menuContainer = document.getElementById('menuContainer');

  if (!session) {
    userInfo.innerHTML = `<a href="login.html">Login</a>`;
    menuContainer.innerHTML = `
      <div class="section-label">Untuk Publik</div>
      <div class="menu-grid">
        ${tile('peta.html', 'map', 'Lihat Peta', 'peta')}
        ${tile('dashboard-kondisi.html', 'chart', 'Ringkasan Mantap/Tidak Mantap', 'laporan')}
      </div>
    `;
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('nama, role')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    userInfo.innerHTML = `<span>Error mengambil profil</span> <button onclick="logout()">Logout</button>`;
    console.error(error);
    return;
  }

  userInfo.innerHTML = `<span>Halo, ${profile.nama || session.user.email} (${profile.role})</span> <button onclick="logout()" style="padding:6px 14px; background:rgba(255,255,255,0.15); color:white; border:1px solid rgba(255,255,255,0.3); border-radius:4px; cursor:pointer;">Logout</button>`;

  let menuHtml = `
    <div class="section-label">Peta & Informasi</div>
    <div class="menu-grid">
      ${tile('peta.html', 'map', 'Lihat Peta', 'peta')}
      ${tile('peta.html', 'search', 'Cari Ruas Jalan', 'peta')}
    </div>
    <div class="section-label">Laporan</div>
    <div class="menu-grid">
      ${tile('dashboard-kondisi.html', 'chart', 'Dashboard Mantap/Tidak Mantap', 'laporan')}
      ${tile('cetak-dd1.html', 'printer', 'Cetak DD1', 'laporan')}
    </div>
  `;

  if (profile.role === 'admin') {
    menuHtml += `
      <div class="section-label">Kelola (Admin)</div>
      <div class="menu-grid">
        ${tile('kelola-data.html', 'gear', 'Kelola Data', 'admin')}
        ${tile('upload-shp.html', 'upload', 'Upload SHP Baru', 'admin')}
      </div>
    `;
  }

  document.getElementById('menuContainer').innerHTML = menuHtml;
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

checkSessionAndRole();