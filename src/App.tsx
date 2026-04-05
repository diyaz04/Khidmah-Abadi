import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Truck, 
  LogOut, 
  Menu, 
  X,
  User,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Plus,
  Search,
  Download,
  Printer,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  increment,
  getDoc,
  where,
  limit,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { auth, db, config } from './lib/firebase';
import { cn, formatCurrency, formatDate } from './lib/utils';
import { Product, Procurement, Sale, SaleItem, Category, UserProfile } from './types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full px-4 py-3 text-sm font-medium transition-colors rounded-lg",
      active 
        ? "bg-blue-50 text-blue-600" 
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    )}
  >
    <Icon className="w-5 h-5 mr-3" />
    {label}
  </button>
);

const Card = ({ children, className, title, subtitle, action }: any) => (
  <div className={cn("bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden", className)}>
    {(title || action) && (
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-2 rounded-lg", color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend && (
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded-full",
          trend > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
        )}>
          {trend > 0 ? "+" : ""}{trend}%
        </span>
      )}
    </div>
    <h4 className="text-sm font-medium text-gray-500">{title}</h4>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
  </div>
);

// --- Main Application ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [registerRole, setRegisterRole] = useState<'admin' | 'staff'>('staff');
  const [isLoginMode, setIsLoginMode] = useState(true);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create user profile
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          const isMainAdmin = firebaseUser.email === 'admin@khidmah.com';
          const newProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || (isMainAdmin ? 'Main Admin' : 'Staff'),
            email: firebaseUser.email || '',
            role: isMainAdmin ? 'admin' : 'staff',
            isMainAdmin: isMainAdmin
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setUserProfile(newProfile as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product)));
    });

    const unsubProcurements = onSnapshot(query(collection(db, 'procurements'), orderBy('date', 'desc'), limit(50)), (snapshot) => {
      setProcurements(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Procurement)));
    });

    const unsubSales = onSnapshot(query(collection(db, 'sales'), orderBy('date', 'desc'), limit(50)), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale)));
    });

    return () => {
      unsubProducts();
      unsubProcurements();
      unsubSales();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Berhasil masuk!');
    } catch (error) {
      console.error(error);
      toast.error('Gagal masuk. Silakan coba lagi.');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let loginEmail = email;
      if (!email.includes('@')) {
        loginEmail = `${email}@khidmah.com`;
      }
      
      try {
        await signInWithEmailAndPassword(auth, loginEmail, password);
        toast.success('Berhasil masuk!');
      } catch (loginError: any) {
        // Jika username adalah 'admin' dan password 'admin123' tapi belum terdaftar
        if (
          email.toLowerCase() === 'admin' && 
          password === 'admin123' && 
          (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/invalid-credential')
        ) {
          toast.loading('Menyiapkan akun admin utama...', { id: 'setup-admin' });
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
            await updateProfile(userCredential.user, { displayName: 'Admin Utama' });
            toast.success('Akun admin utama berhasil disiapkan! Silakan masuk kembali.', { id: 'setup-admin' });
            // Coba login lagi otomatis
            await signInWithEmailAndPassword(auth, loginEmail, password);
          } catch (regError: any) {
            toast.error('Gagal menyiapkan admin: ' + regError.message, { id: 'setup-admin' });
          }
        } else {
          throw loginError;
        }
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Login Email/Password belum diaktifkan di Firebase Console. Silakan aktifkan di menu Authentication > Sign-in method.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Email atau password salah.');
      } else {
        toast.error('Gagal masuk. Silakan coba lagi.');
      }
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let registerEmail = email;
      if (!email.includes('@')) {
        registerEmail = `${email}@khidmah.com`;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, password);
      const newUser = userCredential.user;
      
      await updateProfile(newUser, { displayName });

      const isPending = registerRole === 'admin';
      const newProfile: UserProfile = {
        uid: newUser.uid,
        displayName: displayName || 'User',
        email: registerEmail,
        role: 'staff', // Everyone starts as staff
        isPendingAdmin: isPending,
        isMainAdmin: false
      };
      
      await setDoc(doc(db, 'users', newUser.uid), newProfile);
      setUserProfile(newProfile);

      if (registerRole === 'admin') {
        toast.success('Anda berhasil mengajukan diri sebagai admin, silahkan tunggu konfirmasi dari admin utama', { duration: 5000 });
        // Stay logged in, UI will show pending message
      } else {
        toast.success('Anda berhasil membuat akun silahkan login untuk masuk', { duration: 5000 });
        await signOut(auth);
        setIsLoginMode(true);
        setEmail('');
        setPassword('');
        setDisplayName('');
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Pendaftaran Email/Password belum diaktifkan di Firebase Console. Silakan aktifkan di menu Authentication > Sign-in method.');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('Email atau username ini sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.');
      } else {
        toast.error('Gagal mendaftar: ' + error.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Berhasil keluar!');
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (userProfile?.isPendingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Toaster position="top-right" />
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-100 overflow-hidden">
               <img 
                 src="https://lh3.googleusercontent.com/d/1THnm0UU2JX2F1yi8dcFCgOck0-6yG9Px" 
                 alt="CV. Khidmah Abadi Logo" 
                 className="w-8 h-8 object-contain"
                 crossOrigin="anonymous"
               />
             </div>
             <h1 className="text-xl font-bold text-gray-900">CV. Khidmah Abadi</h1>
           </div>
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-100">
               <AlertTriangle className="w-3 h-3" />
               Menunggu Persetujuan Admin
             </div>
             <button onClick={handleLogout} className="text-gray-600 hover:text-red-600 flex items-center gap-2 text-sm font-medium">
               <LogOut className="w-4 h-4" />
               Keluar
             </button>
           </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full text-center p-8">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Akses Admin Tertunda</h2>
            <p className="text-gray-600 mb-6">
              Sedang menunggu persetujuan admin utama menjadikan anda menjadi admin. 
              Saat ini Anda hanya dapat melihat fitur dasar sebagai Staff.
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
              >
                Refresh Status
              </button>
              <p className="text-xs text-gray-400 italic">
                Hubungi Admin Utama untuk mempercepat proses persetujuan.
              </p>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 border border-gray-100 overflow-hidden">
            <img 
              src="https://lh3.googleusercontent.com/d/1THnm0UU2JX2F1yi8dcFCgOck0-6yG9Px" 
              alt="CV. Khidmah Abadi Logo" 
              className="w-16 h-16 object-contain"
              crossOrigin="anonymous"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CV. Khidmah Abadi</h1>
          <p className="text-gray-500 mb-8">Aplikasi Manajemen Penjualan & Pengadaan Modern</p>
          
          <form onSubmit={isLoginMode ? handleEmailLogin : handleEmailRegister} className="space-y-4 mb-6">
            {!isLoginMode && (
              <>
                <div className="text-left">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Nama Lengkap</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Nama Anda"
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div className="text-left">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1">Pilih Akses / Role</label>
                  <select 
                    value={registerRole}
                    onChange={e => setRegisterRole(e.target.value as 'admin' | 'staff')}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="staff">Staff (Akses Langsung)</option>
                    <option value="admin">Admin (Butuh Persetujuan)</option>
                  </select>
                </div>
              </>
            )}
            <div className="text-left">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Email / Username</label>
              <input 
                type="text" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@khidmah.com"
                className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div className="text-left">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              {isLoginMode ? 'Masuk' : 'Daftar'}
            </button>
          </form>

          <div className="mb-6">
            <button 
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              {isLoginMode ? 'Belum punya akun? Daftar di sini' : 'Sudah punya akun? Masuk di sini'}
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">Atau</span></div>
          </div>

          <button
            onClick={handleLogin}
            className="w-full py-3 px-6 bg-white border border-gray-100 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-1" alt="Google" />
            Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Toaster position="top-right" />
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 z-50 transition-transform lg:translate-x-0 lg:static lg:block",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-100 overflow-hidden">
              <img 
                src="https://lh3.googleusercontent.com/d/1THnm0UU2JX2F1yi8dcFCgOck0-6yG9Px" 
                alt="CV. Khidmah Abadi Logo" 
                className="w-8 h-8 object-contain"
                crossOrigin="anonymous"
              />
            </div>
            <span className="text-xl font-bold text-gray-900">CV. Khidmah Abadi</span>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {userProfile?.role === 'admin' && (
              <SidebarItem 
                icon={LayoutDashboard} 
                label="Dashboard" 
                active={activeTab === 'dashboard'} 
                onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
              />
            )}
            <SidebarItem 
              icon={Package} 
              label="Produk" 
              active={activeTab === 'products'} 
              onClick={() => { setActiveTab('products'); setIsSidebarOpen(false); }} 
            />
            {userProfile?.role === 'admin' && (
              <>
                <SidebarItem 
                  icon={Truck} 
                  label="Pengadaan" 
                  active={activeTab === 'procurement'} 
                  onClick={() => { setActiveTab('procurement'); setIsSidebarOpen(false); }} 
                />
                <SidebarItem 
                  icon={ShoppingCart} 
                  label="Penjualan" 
                  active={activeTab === 'sales'} 
                  onClick={() => { setActiveTab('sales'); setIsSidebarOpen(false); }} 
                />
              </>
            )}
            {userProfile?.isMainAdmin && (
              <SidebarItem 
                icon={User} 
                label="Kelola Admin" 
                active={activeTab === 'users'} 
                onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }} 
              />
            )}
          </nav>

          <div className="p-4 border-t border-gray-50">
            <div className="flex items-center gap-3 px-2 py-3 mb-2">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                className="w-10 h-10 rounded-full border border-gray-100"
                alt="Profile"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName}</p>
                <p className="text-xs text-gray-500 truncate capitalize">{userProfile?.role || 'Staff'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex-1 px-4 max-w-xl hidden md:block">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Cari sesuatu..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {activeTab === 'dashboard' && userProfile?.role === 'admin' && <Dashboard products={products} sales={sales} />}
          {activeTab === 'products' && <ProductManagement products={products} userRole={userProfile?.role} />}
          {activeTab === 'procurement' && userProfile?.role === 'admin' && <ProcurementManagement products={products} procurements={procurements} />}
          {activeTab === 'sales' && userProfile?.role === 'admin' && <SalesManagement products={products} sales={sales} />}
          {activeTab === 'users' && userProfile?.isMainAdmin && <UserManagement />}
        </div>
      </main>
    </div>
  );
}

// --- Sub-Components ---

function Dashboard({ products, sales }: { products: Product[], sales: Sale[] }) {
  const totalSales = sales.reduce((acc, sale) => acc + sale.totalAmount, 0);
  const lowStockProducts = products.filter(p => p.stock <= 10);
  
  // Chart Data
  const salesByDate = sales.reduce((acc: any, sale) => {
    const date = formatDate(sale.date).split(',')[0];
    acc[date] = (acc[date] || 0) + sale.totalAmount;
    return acc;
  }, {});

  const chartData = Object.keys(salesByDate).map(date => ({
    date,
    amount: salesByDate[date]
  })).reverse().slice(-7);

  const categoryData = [
    { name: 'Barang', value: products.filter(p => p.category === 'Barang').length },
    { name: 'Pangan', value: products.filter(p => p.category === 'Pangan').length },
  ];

  const COLORS = ['#3B82F6', '#10B981'];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Penjualan" 
          value={formatCurrency(totalSales)} 
          icon={TrendingUp} 
          color="bg-blue-600"
          trend={12}
        />
        <StatCard 
          title="Total Produk" 
          value={products.length} 
          icon={Package} 
          color="bg-emerald-600"
        />
        <StatCard 
          title="Stok Menipis" 
          value={lowStockProducts.length} 
          icon={AlertTriangle} 
          color="bg-amber-500"
        />
        <StatCard 
          title="Transaksi" 
          value={sales.length} 
          icon={ShoppingCart} 
          color="bg-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2" title="Tren Penjualan (7 Hari Terakhir)">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(val) => `Rp${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => [formatCurrency(val), 'Penjualan']}
                />
                <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Kategori Produk">
          <div className="h-80 w-full flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-4">
              {categoryData.map((cat, i) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-xs text-gray-600">{cat.name} ({cat.value})</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Produk Stok Menipis" subtitle="Segera lakukan pengadaan barang">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-50">
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Stok</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lowStockProducts.map(product => (
                <tr key={product.id} className="text-sm hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 font-medium text-gray-900">{product.name}</td>
                  <td className="px-4 py-4 text-gray-600">{product.category}</td>
                  <td className="px-4 py-4 text-gray-600">{product.stock} {product.unit}</td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      product.stock === 0 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {product.stock === 0 ? "Habis" : "Menipis"}
                    </span>
                  </td>
                </tr>
              ))}
              {lowStockProducts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Semua stok aman.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatStatStatCard({ title, value, icon: Icon, color }: any) {
  return <StatCard title={title} value={value} icon={Icon} color={color} />;
}

function ProductManagement({ products, userRole }: { products: Product[], userRole?: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    sku: '',
    name: '',
    category: 'Barang',
    price: 0,
    stock: 0,
    unit: 'pcs',
    description: ''
  });

  const isAdmin = userRole === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id!), formData);
        toast.success('Produk diperbarui!');
      } else {
        await addDoc(collection(db, 'products'), formData);
        toast.success('Produk ditambahkan!');
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ sku: '', name: '', category: 'Barang', price: 0, stock: 0, unit: 'pcs', description: '' });
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan produk.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (window.confirm('Hapus produk ini?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
        toast.success('Produk dihapus.');
      } catch (error) {
        toast.error('Gagal menghapus.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manajemen Produk</h2>
          <p className="text-gray-500">Kelola daftar barang dan pangan</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => { setIsModalOpen(true); setEditingProduct(null); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Tambah Produk
          </button>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-50">
                <th className="px-4 py-3">ID Barang (SKU)</th>
                <th className="px-4 py-3">Nama Produk</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Harga Jual</th>
                <th className="px-4 py-3">Stok</th>
                <th className="px-4 py-3">Satuan</th>
                {isAdmin && <th className="px-4 py-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map(product => (
                <tr key={product.id} className="text-sm hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 font-mono text-xs text-gray-500">{product.sku}</td>
                  <td className="px-4 py-4 font-medium text-gray-900">{product.name}</td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      product.category === 'Barang' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {product.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-600">{formatCurrency(product.price)}</td>
                  <td className="px-4 py-4 text-gray-600">{product.stock}</td>
                  <td className="px-4 py-4 text-gray-600">{product.unit}</td>
                  {isAdmin && (
                    <td className="px-4 py-4 text-right space-x-2">
                      <button 
                        onClick={() => { setEditingProduct(product); setFormData(product); setIsModalOpen(true); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id!)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Barang (SKU)</label>
                <input 
                  required
                  type="text" 
                  value={formData.sku}
                  onChange={e => setFormData({...formData, sku: e.target.value})}
                  placeholder="Contoh: BRG-001"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value as Category})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Barang">Barang</option>
                    <option value="Pangan">Pangan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Satuan</label>
                  <input 
                    required
                    type="text" 
                    placeholder="pcs, kg, dll"
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual</label>
                  <input 
                    required
                    type="number" 
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok Awal</label>
                  <input 
                    required
                    type="number" 
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (Opsional)</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                />
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                {editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProcurementManagement({ products, procurements }: { products: Product[], procurements: Procurement[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 0,
    buyPrice: 0,
    supplier: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === formData.productId);
    if (!product) return;

    try {
      const procurementData = {
        ...formData,
        sku: product.sku,
        productName: product.name,
        category: product.category,
        date: serverTimestamp()
      };

      await addDoc(collection(db, 'procurements'), procurementData);
      await updateDoc(doc(db, 'products', product.id!), {
        stock: increment(formData.quantity)
      });

      toast.success('Pengadaan berhasil dicatat!');
      setIsModalOpen(false);
      setFormData({ productId: '', quantity: 0, buyPrice: 0, supplier: '' });
    } catch (error) {
      console.error(error);
      toast.error('Gagal mencatat pengadaan. Pastikan Anda memiliki akses staff/admin.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pengadaan Barang</h2>
          <p className="text-gray-500">Input stok masuk dari supplier</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Input Pengadaan
        </button>
      </div>

      <Card title="Riwayat Pengadaan">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-50">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">ID Barang</th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Jumlah</th>
                <th className="px-4 py-3">Harga Beli</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {procurements.map(p => (
                <tr key={p.id} className="text-sm hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-gray-600">{formatDate(p.date)}</td>
                  <td className="px-4 py-4 font-mono text-xs text-gray-500">{p.sku}</td>
                  <td className="px-4 py-4 font-medium text-gray-900">{p.productName}</td>
                  <td className="px-4 py-4 text-gray-600">{p.supplier}</td>
                  <td className="px-4 py-4 text-gray-600">{p.quantity}</td>
                  <td className="px-4 py-4 text-gray-600">{formatCurrency(p.buyPrice)}</td>
                  <td className="px-4 py-4 font-semibold text-gray-900">{formatCurrency(p.quantity * p.buyPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Input Pengadaan</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Produk</label>
                <select 
                  required
                  value={formData.productId}
                  onChange={e => setFormData({...formData, productId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Pilih Produk...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input 
                  required
                  type="text" 
                  value={formData.supplier}
                  onChange={e => setFormData({...formData, supplier: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Masuk</label>
                  <input 
                    required
                    type="number" 
                    value={formData.quantity}
                    onChange={e => setFormData({...formData, quantity: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Beli / Unit</label>
                  <input 
                    required
                    type="number" 
                    value={formData.buyPrice}
                    onChange={e => setFormData({...formData, buyPrice: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                Simpan Pengadaan
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SalesManagement({ products, sales }: { products: Product[], sales: Sale[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customer, setCustomer] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [showInvoice, setShowInvoice] = useState<Sale | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredSales = sales.filter(s => {
    if (!s.date) return false;
    const saleDate = s.date.toDate ? s.date.toDate() : new Date(s.date);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    
    if (start && saleDate < start) return false;
    if (end && saleDate > end) return false;
    return true;
  });

  const exportToExcel = () => {
    const data = filteredSales.map(s => ({
      'Tanggal': formatDate(s.date),
      'ID Transaksi': s.id,
      'Pelanggan': s.customer || '-',
      'Jumlah Item': s.items.length,
      'Total Amount': s.totalAmount
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Penjualan");
    XLSX.writeFile(workbook, `Laporan_Penjualan_${startDate || 'all'}_to_${endDate || 'all'}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Laporan Penjualan - CV. Khidmah Abadi", 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${startDate || 'Semua'} s/d ${endDate || 'Semua'}`, 14, 22);
    
    const tableData = filteredSales.map(s => [
      formatDate(s.date),
      s.id?.slice(0, 12) || '-',
      s.customer || '-',
      `${s.items.length} item`,
      formatCurrency(s.totalAmount)
    ]);
    
    autoTable(doc, {
      startY: 30,
      head: [['Tanggal', 'ID Transaksi', 'Pelanggan', 'Item', 'Total']],
      body: tableData,
    });
    
    doc.save(`Laporan_Penjualan_${startDate || 'all'}_to_${endDate || 'all'}.pdf`);
  };

  const addToCart = () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    
    if (product.stock < quantity) {
      toast.error('Stok tidak mencukupi!');
      return;
    }

    const existingItem = cart.find(item => item.productId === selectedProductId);
    if (existingItem) {
      setCart(cart.map(item => 
        item.productId === selectedProductId 
          ? { ...item, quantity: item.quantity + quantity, total: (item.quantity + quantity) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id!,
        sku: product.sku,
        name: product.name,
        quantity,
        price: product.price,
        total: quantity * product.price
      }]);
    }
    
    setSelectedProductId('');
    setQuantity(1);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const totalAmount = cart.reduce((acc, item) => acc + item.total, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const customId = `INV-${dateStr}-${randomStr}`;

      const saleData: Sale = {
        items: cart,
        totalAmount,
        customer,
        date: serverTimestamp()
      };

      await setDoc(doc(db, 'sales', customId), saleData);
      
      // Update stocks
      for (const item of cart) {
        await updateDoc(doc(db, 'products', item.productId), {
          stock: increment(-item.quantity)
        });
      }

      toast.success('Transaksi berhasil!');
      setShowInvoice({ ...saleData, id: customId, date: now });
      setIsModalOpen(false);
      setCart([]);
      setCustomer('');
    } catch (error) {
      console.error(error);
      toast.error('Gagal memproses transaksi. Pastikan Anda memiliki akses staff/admin.');
    }
  };

  const downloadPDF = async (sale: Sale) => {
    const element = document.getElementById('invoice-content');
    if (!element) return;
    
    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: false,
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`invoice-${sale.id}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Penjualan</h2>
          <p className="text-gray-500">Proses transaksi pelanggan</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-1">
              <label className="text-xs font-medium text-gray-500">Dari:</label>
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-sm outline-none bg-transparent"
              />
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-1">
              <label className="text-xs font-medium text-gray-500">Sampai:</label>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-sm outline-none bg-transparent"
              />
            </div>
          </div>
          <button 
            onClick={exportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button 
            onClick={exportToPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Transaksi Baru
          </button>
        </div>
      </div>

      <Card title="Riwayat Penjualan">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-50">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">ID Transaksi</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSales.map(s => (
                <tr key={s.id} className="text-sm hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-gray-600">{formatDate(s.date)}</td>
                  <td className="px-4 py-4 font-mono text-xs text-gray-500">{s.id?.slice(0, 8)}...</td>
                  <td className="px-4 py-4 text-gray-900">{s.customer || '-'}</td>
                  <td className="px-4 py-4 text-gray-600">{s.items.length} item</td>
                  <td className="px-4 py-4 font-semibold text-gray-900">{formatCurrency(s.totalAmount)}</td>
                  <td className="px-4 py-4 text-right">
                    <button 
                      onClick={() => setShowInvoice(s)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1 ml-auto"
                    >
                      <Printer className="w-4 h-4" />
                      Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sales Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Transaksi Baru</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pelanggan (Opsional)</label>
                  <input 
                    type="text" 
                    value={customer}
                    onChange={e => setCustomer(e.target.value)}
                    placeholder="Nama Pelanggan"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Produk</label>
                    <select 
                      value={selectedProductId}
                      onChange={e => setSelectedProductId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Pilih Produk...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} - {formatCurrency(p.price)} (Stok: {p.stock})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                    <input 
                      type="number" 
                      min="1"
                      value={quantity}
                      onChange={e => setQuantity(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <button 
                    onClick={addToCart}
                    disabled={!selectedProductId}
                    className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2">Produk</th>
                      <th className="px-4 py-2">Harga</th>
                      <th className="px-4 py-2">Qty</th>
                      <th className="px-4 py-2">Total</th>
                      <th className="px-4 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cart.map(item => (
                      <tr key={item.productId} className="text-sm">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(item.total)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => removeFromCart(item.productId)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {cart.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Keranjang masih kosong.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Pembayaran</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
              </div>
              <button 
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md disabled:opacity-50"
              >
                Proses Transaksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoice && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Invoice Transaksi</h3>
              <button onClick={() => setShowInvoice(null)} className="p-2 hover:bg-gray-50 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            
            <div id="invoice-content" className="p-8 bg-white">
              <div className="flex justify-between items-start mb-8 border-b-2 border-blue-600 pb-6">
                <div className="flex items-center gap-4">
                  <img 
                    src="https://lh3.googleusercontent.com/d/1THnm0UU2JX2F1yi8dcFCgOck0-6yG9Px" 
                    alt="CV. Khidmah Abadi Logo" 
                    className="w-16 h-16 object-contain"
                    crossOrigin="anonymous"
                  />
                  <div>
                    <h1 className="text-xl font-black text-blue-600 leading-none mb-1">CV. KHIDMAH ABADI</h1>
                    <p className="text-[10px] text-gray-500 max-w-[200px] leading-tight">
                      Kp cikiangir desa mandalaguna kec. Salopa kab. Tasikmalaya
                    </p>
                    <p className="text-[10px] text-gray-500">Telp: +62 821-3067-0061</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black uppercase text-gray-900 tracking-widest">Invoice</p>
                  <p className="text-xs text-gray-500 font-mono">#{showInvoice.id}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(showInvoice.date)}</p>
                </div>
              </div>

              <div className="mb-8">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Ditujukan Kepada:</p>
                <p className="text-sm font-semibold text-gray-900">{showInvoice.customer || 'Pelanggan Umum'}</p>
              </div>

              <table className="w-full text-left mb-8">
                <thead className="border-b-2 border-gray-100">
                  <tr className="text-xs font-bold text-gray-400 uppercase">
                    <th className="py-2">ID Barang</th>
                    <th className="py-2">Item</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Harga</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {showInvoice.items.map((item, i) => (
                    <tr key={i} className="text-sm">
                      <td className="py-3 font-mono text-[10px] text-gray-500">{item.sku}</td>
                      <td className="py-3 font-medium text-gray-900">{item.name}</td>
                      <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-600">{formatCurrency(item.price)}</td>
                      <td className="py-3 text-right font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-100">
                  <tr>
                    <td colSpan={4} className="py-4 text-right font-bold text-gray-900">TOTAL</td>
                    <td className="py-4 text-right font-black text-blue-600 text-lg">{formatCurrency(showInvoice.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="grid grid-cols-2 gap-8 mt-8">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Informasi Pembayaran:</p>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-800">Bank Transfer</p>
                    <p className="text-[11px] text-blue-700 mt-1">No rek 446001060505531</p>
                    <p className="text-[11px] text-blue-700 font-semibold">A/n andika fitrah alam jamil</p>
                  </div>
                </div>
                <div className="text-center relative">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-12">Hormat Kami,</p>
                  
                  {/* Visual Stamp */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-30 pointer-events-none rotate-12">
                    <img 
                      src="https://lh3.googleusercontent.com/d/1TnVFJhji1PS22zyp8_GYng8g-ijyYppT" 
                      alt="Stamp" 
                      className="w-24 h-24 object-contain"
                      crossOrigin="anonymous"
                    />
                  </div>

                  <div className="border-b border-gray-300 w-32 mx-auto mb-1"></div>
                  <p className="text-[10px] font-bold text-gray-900">Andika Fitrah Alam Jamil</p>
                  <p className="text-[8px] text-gray-500">Penjual</p>
                </div>
              </div>

              <div className="text-center border-t border-dashed border-gray-200 pt-6 mt-8">
                <p className="text-[10px] text-gray-400 italic">"Kepuasan pelanggan adalah prioritas kami"</p>
              </div>
            </div>

            <div className="p-6 bg-gray-50 flex gap-4">
              <button 
                onClick={() => downloadPDF(showInvoice)}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              <button 
                onClick={() => window.print()}
                className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Cetak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'staff' as 'admin' | 'staff'
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Create a secondary app instance to create user without signing out current admin
    const secondaryApp = initializeApp(config, 'Secondary');
    const secondaryAuth = getAuth(secondaryApp);
    
    try {
      let registerEmail = formData.email;
      if (!registerEmail.includes('@')) {
        registerEmail = `${registerEmail}@khidmah.com`;
      }

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, registerEmail, formData.password);
      const newUser = userCredential.user;
      
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        displayName: formData.displayName,
        email: registerEmail,
        role: formData.role,
        isMainAdmin: false
      });

      toast.success('Admin/Staff berhasil ditambahkan!');
      setIsModalOpen(false);
      setFormData({ email: '', password: '', displayName: '', role: 'staff' });
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email atau username ini sudah terdaftar. Silakan gunakan email lain.');
      } else {
        toast.error('Gagal menambahkan user: ' + error.message);
      }
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  const handleApproveAdmin = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: 'admin',
        isPendingAdmin: false
      });
      toast.success('User berhasil disetujui sebagai Admin!');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyetujui admin.');
    }
  };

  const handleDelete = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('User berhasil dihapus dari database!');
      setIsDeleteConfirmOpen(null);
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus user. Pastikan Anda memiliki akses Admin.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kelola Admin</h2>
          <p className="text-gray-500">Manajemen hak akses pengguna</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Tambah User
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-50">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.uid} className="text-sm hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 font-medium text-gray-900">{u.displayName}</td>
                  <td className="px-4 py-4 text-gray-600">{u.email}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium w-fit",
                        u.role === 'admin' ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-600"
                      )}>
                        {u.role === 'admin' ? 'Admin' : 'Staff'}
                        {u.isMainAdmin && ' (Utama)'}
                      </span>
                      {u.isPendingAdmin && (
                        <span className="text-[10px] font-bold text-amber-600 uppercase">Menunggu Persetujuan Admin</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.isPendingAdmin && (
                        <button 
                          onClick={() => handleApproveAdmin(u.uid)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Setujui sebagai Admin"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {!u.isMainAdmin && (
                        <button 
                          onClick={() => setIsDeleteConfirmOpen(u.uid)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 p-6">
            <div className="flex items-center gap-4 text-red-600 mb-4">
              <div className="p-3 bg-red-50 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Hapus User?</h3>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              Apakah Anda yakin ingin menghapus user ini? Tindakan ini hanya menghapus data dari database, akun di Firebase Auth tidak akan terhapus secara otomatis.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsDeleteConfirmOpen(null)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={() => handleDelete(isDeleteConfirmOpen)}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Tambah User Baru</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={formData.displayName}
                  onChange={e => setFormData({...formData, displayName: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Email / Username</label>
                <input 
                  type="text" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Password</label>
                <input 
                  type="password" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Role</label>
                <select 
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as 'admin' | 'staff'})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff (Lihat Stok Saja)</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
