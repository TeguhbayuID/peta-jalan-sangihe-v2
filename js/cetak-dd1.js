let userRole = null;
let ruasMap = {};
let semuaRiwayat = [];

function statusMantap(kondisi) {
  return (kondisi === 'baik' || kondisi === 'sedang') ? 'Mantap' : 'Tidak Mantap';
}

function aturOrientasiCetak(role) {
  const style = document.createElement('style');
  style.id = 'print-orientation';
  if (role === 'admin') {
    style.innerHTML = `@page { size: landscape; margin: 10mm; }`;
  } else {
    style.innerHTML = `@page { size: portrait; margin: 15mm; }`;
  }
  document.head.appendChild(style);
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const userInfo = document.getElementById('userInfo');

  if (!session) {
    document.getElementById('tabelContainer').innerHTML = "<p>Halaman ini khusus untuk Pimpinan/Admin yang sudah login. <a href='login.html'>Login di sini</a>.</p>";
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('nama, role')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    document.getElementById('tabelContainer').innerHTML = "<p>Gagal memuat profil.</p>";
    return;
  }

  userRole = profile.role;
  userInfo.innerHTML = `Halo, ${profile.nama || session.user.email} (${profile.role})`;

  aturOrientasiCetak(userRole);

  const { data: ruasList } = await supabaseClient.from('ruas_jalan').select('*');
  ruasList.forEach(r => { ruasMap[r.ruas_id] = r; });

  const { data: riwayat } = await supabaseClient
    .from('riwayat_kondisi')
    .select('*')
    .order('tahun', { ascending: false });

  semuaRiwayat = riwayat;

  const daftarTahun = [...new Set(riwayat.map(r => r.tahun))].sort((a, b) => b - a);
  const tahunSelect = document.getElementById('tahunSelect');
  daftarTahun.forEach(tahun => {
    const opt = document.createElement('option');
    opt.value = tahun;
    opt.textContent = tahun;
    tahunSelect.appendChild(opt);
  });

  tahunSelect.addEventListener('change', () => renderTabel(parseInt(tahunSelect.value)));

  if (daftarTahun.length > 0) {
    renderTabel(daftarTahun[0]);
  } else {
    document.getElementById('tabelContainer').innerHTML = "<p>Belum ada data.</p>";
  }
}

function buatRekapHtml(dataTahunIni, tahun) {
  let kmMantap = 0;
  let kmTidakMantap = 0;

  dataTahunIni.forEach(item => {
    const totalRincian = (item.baik_km || 0) + (item.sedang_km || 0) + (item.rusak_ringan_km || 0) + (item.rusak_berat_km || 0);

    if (totalRincian > 0) {
      kmMantap += (item.baik_km || 0) + (item.sedang_km || 0);
      kmTidakMantap += (item.rusak_ringan_km || 0) + (item.rusak_berat_km || 0);
    } else {
      const ruas = ruasMap[item.ruas_id] || {};
      const panjang = ruas.panjang_km || 0;
      if (statusMantap(item.kondisi) === 'Mantap') {
        kmMantap += panjang;
      } else {
        kmTidakMantap += panjang;
      }
    }
  });

  const total = kmMantap + kmTidakMantap;
  const persenMantap = total > 0 ? ((kmMantap / total) * 100).toFixed(1) : 0;
  const persenTidakMantap = total > 0 ? ((kmTidakMantap / total) * 100).toFixed(1) : 0;

  return `
    <div style="background:white; border:1px solid #ddd; border-radius:8px; padding:16px; margin-bottom:16px;">
      <h3 style="margin-top:0;">Rekap Kemantapan Jalan Tahun ${tahun}</h3>
      <table style="width:auto;">
        <thead><tr><th>Status</th><th>Panjang (KM)</th><th>Persentase</th></tr></thead>
        <tbody>
          <tr><td>Mantap</td><td>${kmMantap.toFixed(2)}</td><td>${persenMantap}%</td></tr>
          <tr><td>Tidak Mantap</td><td>${kmTidakMantap.toFixed(2)}</td><td>${persenTidakMantap}%</td></tr>
          <tr><td><strong>Total</strong></td><td><strong>${total.toFixed(2)}</strong></td><td><strong>100%</strong></td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderTabel(tahun) {
  const dataTahunIni = semuaRiwayat.filter(r => r.tahun === tahun);
  const container = document.getElementById('tabelContainer');
  const rekapHtml = buatRekapHtml(dataTahunIni, tahun);

  if (userRole === 'admin') {
    let bodyRows = '';
    dataTahunIni.forEach((item, i) => {
      const ruas = ruasMap[item.ruas_id] || {};
      bodyRows += `<tr>
        <td>${item.ruas_id}</td><td>${ruas.nama_ruas || '-'}</td><td>${ruas.kecamatan || '-'}</td>
        <td>${ruas.panjang_km ?? '-'}</td><td>${item.lebar_m ?? '-'}</td>
        <td>${item.hotmix_km ?? 0}</td><td>${item.lapen_km ?? 0}</td><td>${item.perkerasan_beton_km ?? 0}</td><td>${item.telford_km ?? 0}</td><td>${item.tanah_km ?? 0}</td>
        <td>${item.baik_km ?? 0}</td><td>${item.baik_persen ?? 0}</td><td>${item.sedang_km ?? 0}</td><td>${item.sedang_persen ?? 0}</td>
        <td>${item.rusak_ringan_km ?? 0}</td><td>${item.rusak_ringan_persen ?? 0}</td><td>${item.rusak_berat_km ?? 0}</td><td>${item.rusak_berat_persen ?? 0}</td>
        <td>${item.lhr ?? '-'}</td><td>${item.akses_jalan || '-'}</td><td>${item.keterangan || '-'}</td>
      </tr>`;
    });

    const html = `<table>
      <thead>
        <tr>
          <th>No Ruas</th><th>Nama Ruas</th><th>Kecamatan</th>
          <th>Pjg(KM)</th><th>Lbr(M)</th>
          <th>Hotmix</th><th>Lapen</th><th>Beton</th><th>Telford</th><th>Tanah</th>
          <th>Baik KM</th><th>Baik%</th><th>Sdg KM</th><th>Sdg%</th>
          <th>RR KM</th><th>RR%</th><th>RB KM</th><th>RB%</th>
          <th>LHR</th><th>Akses</th><th>Ket</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>`;

    container.innerHTML = rekapHtml + `<h3>DD1 Tahun ${tahun}</h3>` + html;
  } else {
    let bodyRows = '';
    dataTahunIni.forEach((item, i) => {
      const ruas = ruasMap[item.ruas_id] || {};
      bodyRows += `<tr>
        <td>${i + 1}</td><td>${ruas.nama_ruas || '-'}</td><td>${ruas.kecamatan || '-'}</td>
        <td>${ruas.panjang_km ?? '-'}</td><td>${item.kondisi.replace('_', ' ')}</td>
      </tr>`;
    });

    const html = `<table>
      <thead><tr><th>No</th><th>Nama Ruas</th><th>Kecamatan</th><th>Panjang (KM)</th><th>Kondisi</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;

    container.innerHTML = rekapHtml + `<h3>Ringkasan Kondisi Jalan Tahun ${tahun}</h3>` + html;
  }
}

document.getElementById('cetakBtn').addEventListener('click', () => window.print());

init();