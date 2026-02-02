// 1. KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://mgvjwgbjccgsjkjhddru.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ndmp3Z2JqY2Nnc2pramhkZHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzQxNzcsImV4cCI6MjA4NTYxMDE3N30.JJ03f7HO4bKiCF2g0eY3HzrT2KHKUzjpYgBALYHeYa0'; 

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. FUNGSI AUTH & SESI
async function checkUserSession() {
    const { data: { session } } = await client.auth.getSession();
    const path = window.location.pathname;
    
    // Elakkan 'infinite loop' jika sudah berada di page login
    const isAuthPage = ['/login.html', '/register.html', '/index.html', '/forgot-password.html'].some(p => path.includes(p));

    if (!session && !isAuthPage) {
        window.location.href = 'login.html';
    }
    return session?.user;
}

// 3. FUNGSI FORMAT MATA UANG (RM)
function formatRM(amount) {
    return new Intl.NumberFormat('ms-MY', {
        style: 'currency',
        currency: 'MYR',
        minimumFractionDigits: 2
    }).format(amount || 0);
}

// 4. LOGIKA DASHBOARD & PROFILE (DIKEMASKINI)
async function loadUserData() {
    try {
        const { data: { user } } = await client.auth.getUser(); // Gunakan getUser() untuk data lebih tepat
        if (!user) return;

        // Ambil data profil terbaru terus dari database
        const { data: profile, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        if (profile) {
            // Update paparan baki dengan paksaan (force update)
            const balanceEl = document.getElementById('userBalance');
            if (balanceEl) {
                balanceEl.innerText = formatRM(profile.balance);
                console.log("Baki dikemaskini:", profile.balance); // Untuk semakan di console
            }

            if (document.getElementById('userName')) 
                document.getElementById('userName').innerText = profile.full_name || user.email.split('@')[0];
            
            if (document.getElementById('userEmail')) 
                document.getElementById('userEmail').innerText = user.email;
            
            if (document.getElementById('refCode')) 
                document.getElementById('refCode').value = profile.referral_code || '';
        }
    } catch (err) {
        console.error("Gagal memuatkan data user:", err.message);
    }
}

// 5. GLOBAL LOGOUT
async function logout() {
    if (confirm("Adakah anda pasti mahu log keluar?")) {
        await client.auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

// JALANKAN SAAT HALAMAN DIMUAT
document.addEventListener('DOMContentLoaded', () => {
    // Jalankan loadUserData selepas memastikan sesi wujud
    checkUserSession().then(user => {
        if (user) loadUserData();
    });
    
    if (document.querySelector('.tab-item')) setupTabs();
});

// Gantikan bahagian atas app.js anda dengan ini
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
