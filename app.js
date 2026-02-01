const _url = 'https://rgrsqgalhzponuqdkrpd.supabase.co';
const _key = 'sb_publishable_5A42jyOUzPOEa9F6OmFGww_nApDPmoM';
const { createClient } = supabase;
const client = createClient(_url, _key);

// LOG MASUK
async function handleSignIn() {
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    const { data, error } = await client.auth.signInWithPassword({
        email: `${user}@microvest.com`,
        password: pass
    });
    if (error) alert("Gagal: " + error.message);
    else window.location.href = 'dashboard.html';
}

// DAFTAR
async function handleSignUp() {
    const user = document.getElementById('reg-username').value;
    const pass = document.getElementById('reg-password').value;
    const { data, error } = await client.auth.signUp({
        email: `${user}@microvest.com`,
        password: pass
    });
    if (error) alert("Ralat: " + error.message);
    else {
        await client.from('profiles').insert([{ id: data.user.id, email: user, balance: 0.00 }]);
        alert("Berjaya! Sila Log Masuk.");
        window.location.href = 'index.html';
    }
}

// LOGOUT
async function handleLogout() {
    await client.auth.signOut();
    window.location.href = 'index.html';
}

// AMBIL DATA DASHBOARD (Hanya jalan di dashboard.html)
if (window.location.pathname.includes('dashboard.html')) {
    checkUser();
}

async function checkUser() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) window.location.href = 'index.html';
    else {
        const { data: profile } = await client.from('profiles').select('*').eq('id', user.id).single();
        if (profile) {
            document.getElementById('user-display-name').innerText = profile.email;
            document.getElementById('balance-amount').innerText = `RM ${profile.balance.toFixed(2)}`;
        }
    }
}
