// CONFIG SUPABASE
const _url = 'https://rgrsqgalhzponuqdkrpd.supabase.co';
const _key = 'sb_publishable_5A42jyOUzPOEa9F6OmFGww_nApDPmoM';

const { createClient } = supabase;
const client = createClient(_url, _key);

// FUNGSI NAVIGASI
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// 1. DAFTAR AKAUN (Konsep Username)
async function handleSignUp() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    
    if(!user || !pass) return alert("Isi semua ruangan!");

    // Samarkan username jadi email untuk Supabase Auth
    const fakeEmail = `${user}@microvest.com`;

    const { data, error } = await client.auth.signUp({ 
        email: fakeEmail, 
        password: pass 
    });

    if (error) {
        alert(error.message);
    } else {
        // Simpan rekod ke table 'profiles'
        const { error: dbError } = await client.from('profiles').insert([
            { id: data.user.id, email: user, balance: 0.00 }
        ]);
        
        if(dbError) console.error(dbError);
        alert("Pendaftaran Berjaya! Sila Log Masuk.");
    }
}

// 2. LOG MASUK
async function handleSignIn() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    const fakeEmail = `${user}@microvest.com`;

    const { data, error } = await client.auth.signInWithPassword({ 
        email: fakeEmail, 
        password: pass 
    });
    
    if (error) alert("Gagal Log Masuk: Username atau Kata Laluan Salah.");
    else checkUser();
}

// 3. SEMAK STATUS USER (Auto-Login)
async function checkUser() {
    const { data: { user } } = await client.auth.getUser();
    if (user) {
        showPage('home-page');
        // Ambil baki dari database
        const { data: profile } = await client
            .from('profiles')
            .select('email, balance')
            .eq('id', user.id)
            .single();

        if (profile) {
            document.getElementById('user-display-name').innerText = profile.email;
            document.getElementById('balance-amount').innerText = `RM ${profile.balance.toFixed(2)}`;
        }
    } else {
        showPage('auth-page');
    }
}

// 4. LOG KELUAR
async function handleLogout() {
    await client.auth.signOut();
    location.reload();
}

// Jalankan semakan setiap kali aplikasi dibuka
checkUser();
