document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-msg');

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    errorMsg.textContent = "Email atau password salah.";
    console.error(error);
    return;
  }

  // Login berhasil - pindah ke dashboard
  window.location.href = "index.html";
});