// 1. KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://mgvjwgbjccgsjkjhddru.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Gunakan key anda

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
    } catch (err) {
        console.error("Telegram Alert Error:", err);
    }
}

// 3. FUNGSI AUTH & SESI
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

// 4. FUNGSI FORMAT MATA WANG
function formatRM(amount) {
    return new Intl.NumberFormat('ms-MY', {
        style: 'currency',
        currency: 'MYR'
    }).format(amount || 0);
}

// 5. LOAD DATA PROFIL GLOBAL
async function loadUserData() {
    try {
        const { data: { user } } = await client.auth.getUser();
        if (!user) return;

        // Ambil data dari table profiles
        const { data: profile, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // Update semua elemen UI yang berkaitan jika wujud di page tersebut
        if (document.getElementById('userBalance')) {
            document.getElementById('userBalance').innerText = formatRM(profile.balance);
        }
        if (document.getElementById('quickBalance')) {
            document.getElementById('quickBalance').innerText = formatRM(profile.balance);
        }
        if (document.getElementById('userName')) {
            document.getElementById('userName').innerText = profile.full_name || user.email.split('@')[0].toUpperCase();
        }
        if (document.getElementById('userEmail')) {
            document.getElementById('userEmail').innerText = user.email;
        }

        // Aktifkan Real-time listener untuk baki
        setupRealtimeBalance(user.id);

    } catch (err) {
        console.error("Gagal memuatkan data user:", err.message);
    }
}

// 6. REAL-TIME BALANCE UPDATE
function setupRealtimeBalance(userId) {
    client
        .channel('any')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${userId}` 
        }, payload => {
            const newBal = payload.new.balance;
            if (document.getElementById('userBalance')) document.getElementById('userBalance').innerText = formatRM(newBal);
            if (document.getElementById('quickBalance')) document.getElementById('quickBalance').innerText = formatRM(newBal);
        })
        .subscribe();
}

// 7. GLOBAL LOGOUT
async function logout() {
    if (confirm("Adakah anda pasti mahu log keluar?")) {
        await client.auth.signOut();
        window.location.href = 'login.html';
    }
}

// 8. AUTO-RUN
document.addEventListener('DOMContentLoaded', () => {
    checkUserSession().then(user => {
        if (user) loadUserData();
    });
});
