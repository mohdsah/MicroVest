// 1. KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://zleyalzizfmcyjgwqksf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZXlhbHppemZtY3lqZ3dxa3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTY0ODUsImV4cCI6MjA4NTc5MjQ4NX0.BVqjavodtVQaT8Hg8K4Ru-nc3LuO__YHWMJhuhRj-Fs'; 

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. KONFIGURASI TELEGRAM NOTIFY
const TELEGRAM_TOKEN = '8357529301:AAEHyeNZIw-NwIQAE73r05MmqLcHnrWww30';
const ADMIN_CHAT_ID = '163478333';

async function sendTelegramAlert(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: ADMIN_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (err) { console.error("Telegram Alert Error:", err); }
}

// ==========================================
// 3. FUNGSI REGISTER (FIX DUPLICATE KEY ERROR)
// ==========================================
async function handleRegister() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('regBtn');

    btn.innerText = "Mendaftar...";
    btn.disabled = true;

    try {
        // 1. Daftar di Auth
        const { data: authData, error: authError } = await client.auth.signUp({
            email: email,
            password: password,
        });

        if (authError) throw authError;

        // 2. Simpan ke Profiles guna ID dari Auth yang baru
        const { error: profileErr } = await client
            .from('profiles')
            .insert([{ 
                id: authData.user.id, 
                email: email, 
                referral_code: Math.random().toString(36).substring(2, 8).toUpperCase()
            }]);

        if (profileErr) throw profileErr;

        alert("Berjaya! Sila log masuk.");
        window.location.href = 'login.html';
    } catch (err) {
        alert("Ralat: " + err.message);
        btn.innerText = "DAFTAR AKAUN";
        btn.disabled = false;
    }
}


// 4. FUNGSI AUTH & SESI
async function checkUserSession() {
    const { data: { session } } = await client.auth.getSession();
    const path = window.location.pathname;
    const isAuthPage = ['/login.html', '/register.html', '/index.html'].some(p => path.includes(p));

    if (!session && !isAuthPage) {
        window.location.href = 'login.html';
        return null;
    }
    return session?.user;
}

// 5. FORMAT MATA WANG
function formatRM(amount) {
    return new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(amount || 0);
}

// 6. LOAD DATA PROFIL GLOBAL
async function loadUserData() {
    try {
        const { data: { user } } = await client.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // UI Update
        if (document.getElementById('userBalance')) document.getElementById('userBalance').innerText = formatRM(profile.balance);
        if (document.getElementById('userName')) document.getElementById('userName').innerText = user.email.split('@')[0].toUpperCase();
        if (document.getElementById('userEmail')) document.getElementById('userEmail').innerText = user.email;

        setupRealtimeBalance(user.id);
    } catch (err) { console.error("Gagal memuatkan data user:", err.message); }
}

// 7. REAL-TIME UPDATE
function setupRealtimeBalance(userId) {
    client.channel('any').on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` 
    }, payload => {
        const newBal = payload.new.balance;
        if (document.getElementById('userBalance')) document.getElementById('userBalance').innerText = formatRM(newBal);
    }).subscribe();
}

// 8. GLOBAL LOGOUT
async function logout() {
    if (confirm("Adakah anda pasti mahu log keluar?")) {
        await client.auth.signOut();
        window.location.href = 'login.html';
    }
}

// 9. AUTO-RUN
document.addEventListener('DOMContentLoaded', () => {
    checkUserSession().then(user => { if (user) loadUserData(); });
});
