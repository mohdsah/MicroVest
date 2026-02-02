// 1. KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://mgvjwgbjccgsjkjhddru.supabase.co';
// Pastikan anda tampal key eyJh... yang baru di sini
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ndmp3Z2JqY2Nnc2pramhkZHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzQxNzcsImV4cCI6MjA4NTYxMDE3N30.JJ03f7HO4bKiCF2g0eY3HzrT2KHKUzjpYgBALYHeYa0'; 

// Inisialisasi client
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// 2. FUNGSI AUTH & SESI
async function checkUserSession() {
    const { data: { session } } = await client.auth.getSession();
    const path = window.location.pathname;
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

// 4. LOGIKA DASHBOARD & PROFILE
async function loadUserData() {
    const user = await checkUserSession();
    if (!user) return;

    const { data: profile } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profile) {
        // Update elemen UI jika ada
        if (document.getElementById('userBalance')) 
            document.getElementById('userBalance').innerText = formatRM(profile.balance);
        if (document.getElementById('userName')) 
            document.getElementById('userName').innerText = profile.full_name || 'User';
        if (document.getElementById('userEmail')) 
            document.getElementById('userEmail').innerText = user.email;
        if (document.getElementById('refCode')) 
            document.getElementById('refCode').value = profile.referral_code || '';
    }
}

// 5. LOGIKA TAB (Untuk records.html atau transaction-history.html)
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // Tambahkan logika filter data berdasarkan tab di sini
            const filter = tab.getAttribute('data-filter');
            console.log("Filtering by:", filter);
        });
    });
}

// 6. LOGIKA MINING PROGRESS BAR
function updateMiningProgress(percent) {
    const progressBar = document.querySelector('.mining-progress-bar');
    if (progressBar) {
        progressBar.style.width = percent + '%';
    }
}

// 7. GLOBAL LOGOUT & CLEAR CACHE
async function logout() {
    if (confirm("Adakah anda pasti mahu log keluar?")) {
        await client.auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

async function clearUserCache() {
    if (confirm("Bersihkan cache dan reset aplikasi?")) {
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }
}

// JALANKAN SAAT HALAMAN DIMUAT
document.addEventListener('DOMContentLoaded', () => {
    checkUserSession();
    loadUserData();
    if (document.querySelector('.tab-item')) setupTabs();
});
