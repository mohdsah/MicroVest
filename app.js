// 1. KONFIGURASI SUPABASE
const _url = 'https://rgrsqgalhzponuqdkrpd.supabase.co';
const _key = 'sb_publishable_5A42jyOUzPOEa9F6OmFGww_nApDPmoM';
const { createClient } = supabase;
const client = createClient(_url, _key);

// 2. LOGIK PENDAFTARAN (REGISTER)
async function handleRegister(email, password, refCode) {
    const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                referred_by: refCode || null,
                balance: 0
            }
        }
    });

    if (error) {
        alert("Pendaftaran Gagal: " + error.message);
    } else {
        alert("Pendaftaran Berjaya! Sila semak emel untuk pengesahan.");
        window.location.href = 'login.html';
    }
}

// 3. LOGIK LOG MASUK (LOGIN)
async function handleLogin(email, password) {
    const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        alert("Log Masuk Gagal: " + error.message);
    } else {
        // Simpan sesi dan pergi ke dashboard
        window.location.href = 'dashboard.html';
    }
}

// 4. LOGIK LUPA KATA LALUAN
async function handleForgotPassword(email) {
    const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/update-password.html',
    });

    if (error) {
        alert("Ralat: " + error.message);
    } else {
        alert("Pautan reset telah dihantar ke emel anda.");
    }
}

// 5. LOGIK LOG KELUAR (LOGOUT)
async function handleLogout() {
    const { error } = await client.auth.signOut();
    if (!error) {
        window.location.href = 'login.html';
    }
}

// 6. EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    
    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            handleLogin(email, pass);
        });
    }

    // Register Form
    const regForm = document.getElementById('registerForm');
    if (regForm) {
        regForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('regEmail').value;
            const pass = document.getElementById('regPassword').value;
            const ref = document.getElementById('referredBy').value;
            handleRegister(email, pass, ref);
        });
    }
});
