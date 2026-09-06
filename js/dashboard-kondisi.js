let panjangMap = {};
let semuaRiwayat = [];
let isLoggedIn = false;

async function init() {
  // Cek status login (opsional, cuma untuk menampilkan filter tahun)
  const { data: { session } } = await supabaseClient.auth.getSession();
  const userInfo = document.getElementById('userInfo');

  if (session) {
    isLoggedIn = true;
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('nama, role')
      .eq('id', session.user.id)
      .single();
    if (profile) {
      userInfo.innerHTML = `Halo, ${profile.nama || session.user.email} (${profile.role})`;
      document.getElementById('filterContainer').style.display = 'block';
    }
  } else {
    userInfo.innerHTML = `<a href="login.html">Login</a>`;
  }

  // Ambil data panjang tiap ruas
  const { data: ruasList, error: errorRuas } = await supabaseClient
    .from('ruas_jalan')
    .select('ruas_id, panjang_km');

  if (errorRuas) {
    document.getElementById('hasilContainer').textContent = "Gagal memuat data ruas.";
    console.error(errorRuas);
    return;
  }

  ruasList.forEach(r => { panjangMap[r.ruas_id] = r.panjang_km || 0; });

  // Ambil semua riwayat kondisi
  const { data: riwayat, error: errorRiwayat } = await supabaseClient
    .from('riwayat_kondisi')
    .select('ruas_id, tahun, kondisi')
    .order('tahun', { ascending: false });

  if (errorRiwayat) {
    document.getElementById('hasilContainer').textContent = "Gagal memuat data kondisi.";
    console.error(errorRiwayat);
    return;
  }

  semuaRiwayat = riwayat;

  // Isi dropdown tahun (unik)
  const daftarTahun = [...new Set(riwayat.map(r => r.tahun))].sort((a, b) => b - a);
  const tahunSelect = document.getElementById('tahunSelect');
  daftarTahun.forEach(tahun => {
    const opt = document.createElement('option');
    opt.value = tahun;
    opt.textContent = tahun;
    tahunSelect.appendChild(opt);
  });

  tahunSelect.addEventListener('change', () => {
    tampilkanRingkasan(parseInt(tahunSelect.value));
  });

  // Tampilkan tahun terbaru secara default
  if (daftarTahun.length > 0) {
    tampilkanRingkasan(daftarTahun[0]);
  } else {
    document.getElementById('hasilContainer').textContent = "Belum ada data kondisi jalan.";
  }
}

function tampilkanRingkasan(tahun) {
  const dataTahunIni = semuaRiwayat.filter(r => r.tahun === tahun);

  let kmMantap = 0;
  let kmTidakMantap = 0;

  dataTahunIni.forEach(item => {
    const panjang = panjangMap[item.ruas_id] || 0;
    if (item.kondisi === 'baik' || item.kondisi === 'sedang') {
      kmMantap += panjang;
    } else {
      kmTidakMantap += panjang;
    }
  });

  const total = kmMantap + kmTidakMantap;
  const persenMantap = total > 0 ? ((kmMantap / total) * 100).toFixed(1) : 0;
  const persenTidakMantap = total > 0 ? ((kmTidakMantap / total) * 100).toFixed(1) : 0;

  const hasilContainer = document.getElementById('hasilContainer');
  hasilContainer.innerHTML = `
    <div>
      <span class="legend-item"><span class="legend-dot" style="background:#22c55e;"></span>Mantap</span>
      <span class="legend-item"><span class="legend-dot" style="background:#ef4444;"></span>Tidak Mantap</span>
    </div>
    <div class="bar-container">
      <div class="bar-mantap" style="width:${persenMantap}%;">${persenMantap}%</div>
      <div class="bar-tidak-mantap" style="width:${persenTidakMantap}%;">${persenTidakMantap}%</div>
    </div>
    <div class="stat-row">
      <span>Mantap: ${kmMantap.toFixed(2)} km</span>
      <span>Tidak Mantap: ${kmTidakMantap.toFixed(2)} km</span>
      <span>Total: ${total.toFixed(2)} km</span>
    </div>
    <div style="margin-top:12px; font-size:13px; color:#888;">Data tahun ${tahun}</div>
  `;
}

init();