import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  TrendingDown,
  AlertTriangle,
  Plus,
  Search,
  Download,
  Printer,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  Eye,
  Grid
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
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
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
  setDoc,
  getDocFromServer
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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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

const Card = ({ children, className, title, subtitle, action, noPadding = false }: any) => (
  <div className={cn("bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md", className)}>
    {(title || action) && (
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
        <div>
          {title && <h3 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-gray-400 font-medium">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className={cn(noPadding ? "" : "p-6")}>{children}</div>
  </div>
);

const StatCard = ({ title, value, icon: Icon, trend, color, className }: any) => (
  <div className={cn("bg-white p-5 lg:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between h-full transition-all hover:shadow-md", className)}>
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-3 rounded-2xl", color)}>
        <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold",
          trend > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
        )}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend > 0 ? "+" : ""}{trend}%
        </div>
      )}
    </div>
    <div>
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</h4>
      <p className="text-xl lg:text-2xl font-black text-gray-900">{value}</p>
    </div>
  </div>
);

function ConfirmDeleteModal({ isOpen, onClose, onConfirm, title, message }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 p-6">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <AlertTriangle className="w-6 h-6" />
          <h3 className="text-lg font-bold">{title || 'Konfirmasi Hapus'}</h3>
        </div>
        <p className="text-gray-600 text-sm mb-6">{message || 'Apakah Anda yakin ingin menghapus data ini?'}</p>
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
          >
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

const CATEGORIES: Category[] = ['Barang', 'Pangan', 'Jasa', 'Buah-buahan', 'Susu', 'Roti', 'Keringan', 'Sayuran', 'Bumbu Pelengkap masak'];

const CATEGORY_IMAGES: Record<Category, string> = {
  'Barang': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80',
  'Pangan': 'https://images.unsplash.com/photo-1506484334402-40ff22e0d467?w=400&q=80',
  'Jasa': 'https://images.unsplash.com/photo-1454165833767-027eeea15c3e?w=400&q=80',
  'Buah-buahan': 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400&q=80',
  'Susu': 'https://images.unsplash.com/photo-1563636619-e910f01859ec?w=400&q=80',
  'Roti': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
  'Keringan': 'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?w=400&q=80',
  'Sayuran': 'https://images.unsplash.com/photo-1566385101042-1a0aa0c12e8c?w=400&q=80',
  'Bumbu Pelengkap masak': 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=400&q=80'
};

function Catalog({ products, userProfile }: { products: Product[], userProfile: UserProfile | null }) {
  const [selectedCategory, setSelectedCategory] = useState<Category | 'Semua'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditingDesc, setIsEditingDesc] = useState<string | null>(null);
  const [editDescValue, setEditDescValue] = useState('');

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSaveDescription = async (productId: string) => {
    if (!userProfile?.isMainAdmin) {
      toast.error('Hanya Admin Utama yang dapat mengubah deskripsi.');
      return;
    }
    try {
      await updateDoc(doc(db, 'products', productId), {
        description: editDescValue
      });
      setIsEditingDesc(null);
      toast.success('Deskripsi berhasil diperbarui!');
    } catch (error) {
      console.error(error);
      toast.error('Gagal memperbarui deskripsi.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Katalog Produk</h2>
          <p className="text-gray-500 mt-1">Jelajahi koleksi produk CV. Khidmah Abadi</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64"
            />
          </div>
          <select 
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value as any)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="Semua">Semua Kategori</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <div 
            key={product.id}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
          >
            <div 
              className="relative aspect-square overflow-hidden cursor-pointer"
              onClick={() => setSelectedProduct(product)}
            >
              <img 
                src={product.imageUrl || CATEGORY_IMAGES[product.category]} 
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-xs font-bold text-gray-900 flex items-center gap-2">
                  <Eye className="w-3 h-3" />
                  Lihat Detail
                </div>
              </div>
              <div className="absolute top-3 left-3">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-blue-600 rounded-full shadow-sm border border-white/20">
                  {product.category}
                </span>
              </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <div className="mb-3">
                <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{product.sku}</p>
              </div>
              
              <div className="mt-auto space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-blue-600">{formatCurrency(product.price)}</span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                    product.stock > 10 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  )}>
                    Stok: {product.stock} {product.unit}
                  </span>
                </div>

                <div className="pt-4 border-t border-gray-50">
                  {isEditingDesc === product.id ? (
                    <div className="space-y-2">
                      <textarea 
                        value={editDescValue}
                        onChange={e => setEditDescValue(e.target.value)}
                        className="w-full p-2 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none h-20"
                        placeholder="Masukkan deskripsi produk..."
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleSaveDescription(product.id!)}
                          className="flex-1 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg"
                        >
                          Simpan
                        </button>
                        <button 
                          onClick={() => setIsEditingDesc(null)}
                          className="flex-1 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-lg"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group/desc">
                      <p className="text-xs text-gray-500 line-clamp-2 italic">
                        {product.description || 'Tidak ada deskripsi.'}
                      </p>
                      {userProfile?.isMainAdmin && (
                        <button 
                          onClick={() => {
                            setIsEditingDesc(product.id!);
                            setEditDescValue(product.description || '');
                          }}
                          className="absolute -top-1 -right-1 p-1 bg-white border border-gray-100 rounded-md shadow-sm opacity-0 group-hover/desc:opacity-100 transition-opacity"
                        >
                          <Edit className="w-3 h-3 text-blue-600" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
            <div className="flex flex-col md:flex-row overflow-y-auto">
              <div className="md:w-1/2 aspect-square md:aspect-auto">
                <img 
                  src={selectedProduct.imageUrl || CATEGORY_IMAGES[selectedProduct.category]} 
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="md:w-1/2 p-8 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                      {selectedProduct.category}
                    </span>
                    <h3 className="text-2xl font-black text-gray-900 mt-3">{selectedProduct.name}</h3>
                    <p className="text-sm text-gray-400 font-mono mt-1">{selectedProduct.sku}</p>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-6 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Harga Satuan</p>
                      <p className="text-xl font-black text-blue-600">{formatCurrency(selectedProduct.price)}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Stok Tersedia</p>
                      <p className="text-xl font-black text-gray-900">{selectedProduct.stock} {selectedProduct.unit}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Deskripsi Produk</p>
                    <p className="text-sm text-gray-600 leading-relaxed italic">
                      {selectedProduct.description || 'Produk ini belum memiliki deskripsi detail.'}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold mt-8 hover:bg-gray-800 transition-all shadow-lg"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Application ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [registerRole, setRegisterRole] = useState<'admin' | 'staff' | 'viewer'>('staff');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
          toast.error("Koneksi database bermasalah. Silakan periksa konfigurasi Firebase.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const [isClaiming, setIsClaiming] = useState(false);
  const updatingProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setIsClaiming(false);
      return;
    }

    if (updatingProfileRef.current === user.uid) return;

    console.log("Starting profile snapshot for UID:", user.uid);
    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      // Don't process if we are currently updating/claiming for this user
      if (updatingProfileRef.current === user.uid) return;

      console.log("Profile snapshot update for UID:", user.uid, "Exists:", docSnap.exists());
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        
        // If profile is pre-registered but UID matches, finalize it
        if (profile.isPreRegistered) {
          console.log("Finalizing pre-registered profile for matched UID:", user.uid);
          updatingProfileRef.current = user.uid;
          setIsClaiming(true);
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              isPreRegistered: false,
              lastLogin: serverTimestamp()
            });
          } catch (e) {
            console.error("Error finalizing profile:", e);
          } finally {
            updatingProfileRef.current = null;
            setIsClaiming(false);
          }
          return;
        }
        
        setUserProfile(profile);
        console.log("Profile data loaded:", profile.role, profile.displayName);
      } else {
        console.log("No profile found for UID:", user.uid, "Checking for pre-registration...");
        // Profile doesn't exist yet - Check for pre-registered profile by email
        updatingProfileRef.current = user.uid;
        setIsClaiming(true);
        try {
          const q = query(collection(db, 'users'), where('email', '==', user.email), where('isPreRegistered', '==', true));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const preRegDoc = querySnapshot.docs[0];
            const preRegData = preRegDoc.data();
            console.log("Found pre-registered profile to claim:", preRegData.role);
            
            // Claim the profile: Copy to users/{uid} and delete old doc
            await setDoc(doc(db, 'users', user.uid), {
              ...preRegData,
              uid: user.uid,
              isPreRegistered: false, // No longer pre-registered
              lastLogin: serverTimestamp()
            });
            
            await deleteDoc(doc(db, 'users', preRegDoc.id));
            console.log("Profile claimed successfully for UID:", user.uid);
          } else {
            console.log("No pre-registration found for email:", user.email);
            setUserProfile(null);
          }
        } catch (claimError: any) {
          console.error("Error claiming profile for email:", user.email, "Error:", claimError.message);
          setUserProfile(null);
        } finally {
          updatingProfileRef.current = null;
          setIsClaiming(false);
        }
      }
      setLoading(false);
    }, (error) => {
      if (updatingProfileRef.current === user.uid) return;
      console.error("Profile Snapshot Error for UID:", user.uid, "Code:", (error as any).code, "Message:", error.message);
      try {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      } catch (err) {
        // Error already logged
      }
      setLoading(false);
    });

    return () => unsubProfile();
  }, [user]);

  useEffect(() => {
    // Prevent data fetching if not fully approved or if no profile
    // Only Main Admin or non-pending users can see full data
    if (!userProfile || (userProfile.isPendingAdmin && !userProfile.isMainAdmin)) return;

    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product)));
    }, (error) => {
      console.error('Products Snapshot Error:', error);
      try {
        handleFirestoreError(error, OperationType.GET, 'products');
      } catch (err) {
        // Error already logged
      }
    });

    let unsubProcurements = () => {};
    if (userProfile.role === 'admin') {
      unsubProcurements = onSnapshot(query(collection(db, 'procurements'), orderBy('date', 'desc'), limit(50)), (snapshot) => {
        setProcurements(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Procurement)));
      }, (error) => {
        console.error('Procurements Snapshot Error:', error);
        try {
          handleFirestoreError(error, OperationType.GET, 'procurements');
        } catch (err) {
          // Error already logged
        }
      });
    }

    let unsubSales = () => {};
    if (userProfile.role === 'admin' || userProfile.role === 'staff') {
      unsubSales = onSnapshot(query(collection(db, 'sales'), orderBy('date', 'desc'), limit(50)), (snapshot) => {
        setSales(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale)));
      }, (error) => {
        console.error('Sales Snapshot Error:', error);
        try {
          handleFirestoreError(error, OperationType.GET, 'sales');
        } catch (err) {
          // Error already logged
        }
      });
    }

    return () => {
      unsubProducts();
      unsubProcurements();
      unsubSales();
    };
  }, [userProfile]);

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
    if (isAuthLoading) return;
    if (!email || !password) {
      toast.error('Email/Username dan password wajib diisi.');
      return;
    }
    setIsAuthLoading(true);
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
        const isAuthPlatformError = loginError.code === 'auth/invalid-credential' || loginError.message?.includes('auth/invalid-credential');
        const isUserNotFoundError = loginError.code === 'auth/user-not-found';
        const isAdminUser = email.toLowerCase() === 'admin' || email.toLowerCase() === 'admin@khidmah.com';

        if (
          isAdminUser && 
          password === 'admin123' && 
          (isUserNotFoundError || isAuthPlatformError)
        ) {
          toast.loading('Menyiapkan akun admin utama...', { id: 'setup-admin' });
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
            await updateProfile(userCredential.user, { displayName: 'Admin Utama' });
            
            // Create user document in Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), {
              uid: userCredential.user.uid,
              displayName: 'Admin Utama',
              email: loginEmail,
              role: 'admin',
              isMainAdmin: true,
              isPendingAdmin: false,
              createdAt: serverTimestamp()
            });

            toast.success('Akun admin utama berhasil disiapkan!', { id: 'setup-admin' });
          } catch (regError: any) {
            if (regError.code === 'auth/email-already-in-use' || regError.message?.includes('auth/email-already-in-use')) {
              toast.error('Password admin salah.', { id: 'setup-admin' });
            } else {
              toast.error('Gagal menyiapkan admin: ' + regError.message, { id: 'setup-admin' });
            }
          }
        } else {
          throw loginError;
        }
      }
    } catch (error: any) {
      const isCredentialError = 
        error.code === 'auth/invalid-credential' || 
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/user-not-found' || 
        error.message?.includes('auth/invalid-credential');

      // Only log to console if it's NOT a simple credential/password error
      if (!isCredentialError) {
        console.error('Login error detail:', error);
      }

      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Login Email/Password belum diaktifkan di Firebase Console.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Terlalu banyak percobaan masuk. Mohon tunggu beberapa menit atau gunakan Google Login.');
      } else if (isCredentialError) {
        toast.error('Email atau password salah.');
      } else {
        toast.error('Gagal masuk: ' + (error.message || 'Terjadi kesalahan'));
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthLoading) return;

    // If user is already authenticated (e.g. Google), we just need to create the profile
    if (user && !userProfile) {
      if (!displayName) {
        toast.error('Nama wajib diisi.');
        return;
      }
      setIsAuthLoading(true);
      try {
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: displayName || user.displayName || 'User',
          email: user.email || '',
          role: registerRole,
          isPendingAdmin: true, // Always true for self-reg
          isMainAdmin: false,
          isApprovedViewer: false // Blocked until approval
        };
        
        // Check if this is a bootstrap admin email
        if (user.email === 'diyaznajib.93@gmail.com' || user.email === 'admin@khidmah.com') {
          newProfile.isPendingAdmin = false;
          newProfile.isMainAdmin = true;
          newProfile.role = 'admin';
        }

        await setDoc(doc(db, 'users', user.uid), newProfile);
        setUserProfile(newProfile);
        toast.success('Profil berhasil dibuat!');
      } catch (error: any) {
        console.error(error);
        toast.error('Gagal membuat profil: ' + error.message);
      } finally {
        setIsAuthLoading(false);
      }
      return;
    }

    if (!email || !password || !displayName) {
      toast.error('Nama, Email/Username dan password wajib diisi.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password minimal 6 karakter.');
      return;
    }
    setIsAuthLoading(true);
    const selectedRole = registerRole; // Capture the current state value
    try {
      let registerEmail = email;
      if (!email.includes('@')) {
        registerEmail = `${email}@khidmah.com`;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, password);
      const newUser = userCredential.user;
      
      await updateProfile(newUser, { displayName });

      const newProfile: UserProfile = {
        uid: newUser.uid,
        displayName: displayName || 'User',
        email: registerEmail,
        role: selectedRole, // Use the captured role
        isPendingAdmin: true, // Always true for self-reg
        isMainAdmin: false,
        isApprovedViewer: false // Blocked until approval
      };
      
      await setDoc(doc(db, 'users', newUser.uid), newProfile);
      setUserProfile(newProfile);

      const roleName = selectedRole === 'admin' ? 'admin' : selectedRole === 'viewer' ? 'viewer' : 'staff';
      toast.success(`Anda berhasil mendaftar sebagai ${roleName}, silakan tunggu persetujuan admin utama.`);
      // Stay logged in, UI will show pending message
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use' || error.message?.includes('auth/email-already-in-use')) {
        toast.error('Email atau username ini sudah terdaftar. Mengalihkan ke halaman Masuk...');
        setIsLoginMode(true); // Switch to login mode automatically
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error('Pendaftaran Email/Password belum diaktifkan di Firebase Console. Silakan aktifkan di menu Authentication > Sign-in method.');
      } else {
        console.error(error);
        toast.error('Gagal mendaftar: ' + (error.message || 'Terjadi kesalahan'));
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Silakan masukkan email/username Anda untuk reset password.');
      return;
    }
    let resetEmail = email;
    if (!email.includes('@')) {
      resetEmail = `${email}@khidmah.com`;
    }
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success('Email reset password telah dikirim! Silakan cek kotak masuk Anda.');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/user-not-found') {
        toast.error('Email/Username tidak ditemukan.');
      } else {
        toast.error('Gagal mengirim email reset: ' + error.message);
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

  if (loading || isClaiming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 font-medium">{isClaiming ? 'Menyingkronkan Profil...' : 'Memuat Sesi...'}</p>
      </div>
    );
  }

  // If not logged in, show login/register screen
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
                    onChange={e => setRegisterRole(e.target.value as 'admin' | 'staff' | 'viewer')}
                    className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="staff">Staff (Butuh Persetujuan)</option>
                    <option value="admin">Admin (Butuh Persetujuan)</option>
                    <option value="viewer">Viewer (Butuh Persetujuan)</option>
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
              disabled={isAuthLoading}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAuthLoading ? 'Memproses...' : (isLoginMode ? 'Masuk' : 'Daftar')}
            </button>

            {isLoginMode && (
              <div className="mt-2">
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Lupa Password?
                </button>
              </div>
            )}
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

  // If logged in but no profile exists, show profile completion screen
  if (!userProfile) {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Lengkapi Profil</h1>
          <p className="text-gray-500 mb-8">Silakan lengkapi data diri Anda untuk melanjutkan</p>
          
          <form onSubmit={handleEmailRegister} className="space-y-4 mb-6">
            <div className="text-left">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Nama Lengkap</label>
              <input 
                type="text" 
                value={displayName || user.displayName || ''}
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
                onChange={e => setRegisterRole(e.target.value as 'admin' | 'staff' | 'viewer')}
                className="w-full mt-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="staff">Staff (Butuh Persetujuan)</option>
                <option value="admin">Admin (Butuh Persetujuan)</option>
                <option value="viewer">Viewer (Butuh Persetujuan)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAuthLoading ? 'Memproses...' : 'Simpan Profil'}
            </button>
          </form>

          <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 text-sm font-medium">
            Keluar & Gunakan Akun Lain
          </button>
        </div>
      </div>
    );
  }

  if (userProfile.isPendingAdmin && !userProfile.isMainAdmin) {
    const isViewerPending = userProfile?.role === 'viewer' && !userProfile?.isApprovedViewer;
    
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Toaster position="top-right" />
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-100 overflow-hidden">
               <img 
                 src="https://lh3.googleusercontent.com/d/1THnm0UU2JX2F1yi8dcFCgOck0-6yG9Px" 
                 alt="CV Khidmah Abadi Logo" 
                 className="w-8 h-8 object-contain"
                 crossOrigin="anonymous"
               />
             </div>
             <h1 className="text-xl font-bold text-gray-900">CV Khidmah Abadi</h1>
           </div>
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-100">
               <AlertTriangle className="w-3 h-3" />
               {isViewerPending ? 'Menunggu Konfirmasi Katalog' : 'Menunggu Persetujuan Admin'}
             </div>
             <button onClick={handleLogout} className="text-gray-600 hover:text-red-600 flex items-center gap-2 text-sm font-medium">
               <LogOut className="w-4 h-4" />
               Keluar
             </button>
           </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Akses Tertunda</h2>
            <p className="text-amber-600 font-semibold mb-4">Menunggu Persetujuan Admin Utama</p>
            <p className="text-gray-600 mb-6">
              Akun Anda telah berhasil terdaftar. Silakan tunggu admin utama menyetujui akses Anda sebelum Anda dapat menggunakan fitur aplikasi.
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
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <Toaster position="top-right" />
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile, shown on desktop */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 z-50 transition-transform lg:translate-x-0 lg:static lg:block hidden",
        isSidebarOpen ? "translate-x-0 !block" : "-translate-x-full"
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
            <span className="text-xl font-bold text-gray-900">CV Khidmah Abadi</span>
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
            {(userProfile?.role === 'admin' || userProfile?.role === 'staff') && (
              <SidebarItem 
                icon={Package} 
                label="Produk" 
                active={activeTab === 'products'} 
                onClick={() => { setActiveTab('products'); setIsSidebarOpen(false); }} 
              />
            )}
            <SidebarItem 
              icon={Grid} 
              label="Katalog" 
              active={activeTab === 'catalog'} 
              onClick={() => { setActiveTab('catalog'); setIsSidebarOpen(false); }} 
            />
            {(userProfile?.role === 'admin' || userProfile?.role === 'staff') && (
              <>
                {userProfile?.role === 'admin' && (
                  <SidebarItem 
                    icon={Truck} 
                    label="Pengadaan" 
                    active={activeTab === 'procurement'} 
                    onClick={() => { setActiveTab('procurement'); setIsSidebarOpen(false); }} 
                  />
                )}
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
              onClick={() => setIsChangePasswordOpen(true)}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors mb-1"
            >
              <Edit className="w-5 h-5 mr-3" />
              Ganti Password
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Keluar
            </button>
          </div>
          {userProfile?.isMainAdmin && (
            <div className="mt-auto p-4 border-t border-gray-100">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Debug Info (Admin Utama)</p>
                <div className="space-y-1 text-[10px] text-gray-500 font-mono">
                  <p>UID: {user?.uid.slice(0, 8)}...</p>
                  <p>Email: {user?.email}</p>
                  <p>Verified: {user?.emailVerified ? 'Yes' : 'No'}</p>
                  <p>Role: {userProfile?.role}</p>
                  <p>DB: {config.projectId.slice(0, 10)}...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-20 lg:pb-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 lg:hidden">
            <img 
              src="https://lh3.googleusercontent.com/d/1THnm0UU2JX2F1yi8dcFCgOck0-6yG9Px" 
              alt="Logo" 
              className="w-8 h-8 object-contain"
            />
            <span className="font-bold text-gray-900">Khidmah Abadi</span>
          </div>
          
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
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {activeTab === 'dashboard' && userProfile?.role === 'admin' && <Dashboard products={products} sales={sales} userProfile={userProfile} />}
          {activeTab === 'products' && userProfile?.role !== 'viewer' && <ProductManagement products={products} userRole={userProfile?.role} />}
          {activeTab === 'catalog' && <Catalog products={products} userProfile={userProfile} />}
          {activeTab === 'procurement' && userProfile?.role === 'admin' && <ProcurementManagement products={products} procurements={procurements} />}
          {activeTab === 'sales' && userProfile?.role !== 'viewer' && <SalesManagement products={products} sales={sales} userRole={userProfile?.role} />}
          {activeTab === 'users' && userProfile?.isMainAdmin && <UserManagement />}
        </div>

        {isChangePasswordOpen && (
          <ChangePasswordModal 
            isOpen={isChangePasswordOpen} 
            onClose={() => setIsChangePasswordOpen(false)} 
            user={user}
            userProfile={userProfile}
          />
        )}

        {/* Bottom Navigation for Mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <BottomNavItem 
            icon={LayoutDashboard} 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            show={userProfile?.role === 'admin'}
          />
          <BottomNavItem 
            icon={Package} 
            active={activeTab === 'products'} 
            onClick={() => setActiveTab('products')} 
            show={userProfile?.role === 'admin' || userProfile?.role === 'staff'}
          />
          <BottomNavItem 
            icon={Grid} 
            active={activeTab === 'catalog'} 
            onClick={() => setActiveTab('catalog')} 
            show={true}
          />
          <BottomNavItem 
            icon={ShoppingCart} 
            active={activeTab === 'sales'} 
            onClick={() => setActiveTab('sales')} 
            show={userProfile?.role === 'admin' || userProfile?.role === 'staff'}
          />
          <BottomNavItem 
            icon={User} 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')} 
            show={userProfile?.isMainAdmin}
          />
        </nav>
      </main>
    </div>
  );
}

function BottomNavItem({ icon: Icon, active, onClick, show }: { icon: any, active: boolean, onClick: () => void, show?: boolean }) {
  if (!show) return null;
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 rounded-2xl transition-all duration-300 flex flex-col items-center gap-1",
        active ? "text-blue-600 bg-blue-50" : "text-gray-400 hover:text-gray-600"
      )}
    >
      <Icon className={cn("w-6 h-6", active && "animate-in zoom-in duration-300")} />
      {active && <div className="w-1 h-1 bg-blue-600 rounded-full" />}
    </button>
  );
}

// --- Sub-Components ---

function Dashboard({ products, sales, userProfile }: { products: Product[], sales: Sale[], userProfile: UserProfile | null }) {
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

  const categoryData = CATEGORIES.map(cat => ({
    name: cat,
    value: products.filter(p => p.category === cat).length
  })).filter(c => c.value > 0);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#6366F1'];

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Halo, {userProfile?.displayName}! 👋</h2>
          <p className="text-gray-500 text-sm font-medium">Berikut ringkasan bisnis Anda hari ini.</p>
        </div>
        <div className="flex items-center gap-3 bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
          <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Performa</p>
            <p className="text-base font-black text-gray-900">+12.5% <span className="text-[10px] font-bold text-gray-400">vs bln lalu</span></p>
          </div>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard 
          title="Total Penjualan" 
          value={formatCurrency(totalSales)} 
          icon={TrendingUp} 
          color="bg-blue-600"
          trend={12}
          className="col-span-2 lg:col-span-1"
        />
        <StatCard 
          title="Produk" 
          value={products.length} 
          icon={Package} 
          color="bg-emerald-600"
        />
        <StatCard 
          title="Stok Tipis" 
          value={lowStockProducts.length} 
          icon={AlertTriangle} 
          color="bg-amber-500"
        />
        <StatCard 
          title="Transaksi" 
          value={sales.length} 
          icon={ShoppingCart} 
          color="bg-indigo-600"
          className="hidden lg:flex"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <Card className="lg:col-span-2 !p-0 overflow-hidden" title="Tren Penjualan" noPadding>
          <div className="p-6 pb-0">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-4">7 Hari Terakhir</p>
          </div>
          <div className="h-64 lg:h-80 w-full px-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }} tickFormatter={(val) => `Rp${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)' }}
                  formatter={(val: number) => [formatCurrency(val), 'Penjualan']}
                />
                <Bar dataKey="amount" fill="#3B82F6" radius={[8, 8, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Kategori" className="flex flex-col">
          <div className="h-64 lg:h-80 w-full flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 w-full">
              {categoryData.slice(0, 4).map((cat, i) => (
                <div key={cat.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-[10px] text-gray-500 font-bold truncate">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Stok Menipis" subtitle="Segera lakukan pengadaan barang" className="overflow-hidden" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                <th className="px-6 py-5">Produk</th>
                <th className="px-6 py-5">Kategori</th>
                <th className="px-6 py-5">Stok</th>
                <th className="px-6 py-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lowStockProducts.map(product => (
                <tr key={product.id} className="text-sm hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-5 font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{product.name}</td>
                  <td className="px-6 py-5 text-gray-500 font-medium">{product.category}</td>
                  <td className="px-6 py-5 text-gray-500 font-mono font-bold">{product.stock} {product.unit}</td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest",
                      product.stock === 0 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {product.stock === 0 ? "Habis" : "Menipis"}
                    </span>
                  </td>
                </tr>
              ))}
              {lowStockProducts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-gray-400 font-medium italic">Semua stok aman.</td>
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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'sku-asc' | 'sku-desc' | 'date-desc' | 'date-asc'>('name-asc');
  const [formData, setFormData] = useState<Partial<Product>>({
    sku: '',
    name: '',
    category: 'Barang',
    price: 0,
    stock: 0,
    unit: 'pcs',
    description: '',
    imageUrl: ''
  });

  const isAdmin = userRole === 'admin';
  const isViewer = userRole === 'viewer';

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    if (sortBy === 'sku-asc') return a.sku.localeCompare(b.sku);
    if (sortBy === 'sku-desc') return b.sku.localeCompare(a.sku);
    if (sortBy === 'date-desc' || sortBy === 'date-asc') {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return sortBy === 'date-desc' ? dateB - dateA : dateA - dateB;
    }
    return 0;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id!), formData);
        toast.success('Produk diperbarui!');
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        toast.success('Produk ditambahkan!');
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ sku: '', name: '', category: 'Barang', price: 0, stock: 0, unit: 'pcs', description: '', imageUrl: '' });
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan produk.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('Produk dihapus.');
    } catch (error) {
      toast.error('Gagal menghapus.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manajemen Produk</h2>
          <p className="text-gray-500">Kelola daftar barang dan pangan</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm">
            <label className="text-xs font-bold text-gray-400 uppercase">Urutkan:</label>
            <select 
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="text-sm font-medium text-gray-600 outline-none bg-transparent"
            >
              <option value="name-asc">Nama (A-Z)</option>
              <option value="name-desc">Nama (Z-A)</option>
              <option value="sku-asc">SKU (A-Z)</option>
              <option value="sku-desc">SKU (Z-A)</option>
              <option value="date-desc">Terbaru</option>
              <option value="date-asc">Terlama</option>
            </select>
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
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-50">
                <th className="px-4 py-3">ID Barang (SKU)</th>
                <th className="px-4 py-3">Nama Produk</th>
                <th className="px-4 py-3">Deskripsi</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Harga Jual</th>
                <th className="px-4 py-3">Stok</th>
                <th className="px-4 py-3">Satuan</th>
                {isAdmin && <th className="px-4 py-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedProducts.map(product => (
                <tr key={product.id} className="text-sm hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 font-mono text-xs text-gray-500">{product.sku}</td>
                  <td className="px-4 py-4 font-medium text-gray-900">{product.name}</td>
                  <td className="px-4 py-4 text-gray-500 text-xs max-w-[200px] truncate" title={product.description}>
                    {product.description || '-'}
                  </td>
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
                        onClick={() => setIsDeleteConfirmOpen(product.id!)}
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

      <ConfirmDeleteModal 
        isOpen={!!isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(null)}
        onConfirm={() => isDeleteConfirmOpen && handleDelete(isDeleteConfirmOpen)}
        title="Hapus Produk?"
        message="Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan."
      />

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Barang (SKU)</label>
                <input 
                  required
                  type="text" 
                  value={formData.sku}
                  onChange={e => setFormData({...formData, sku: e.target.value})}
                  placeholder="Contoh: BRG-001"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value as Category})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
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
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok Awal</label>
                  <input 
                    required
                    type="number" 
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Gambar (Opsional)</label>
                <input 
                  type="text" 
                  value={formData.imageUrl}
                  onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (Opsional)</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  rows={3}
                />
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex-shrink-0"
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
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'>('date-desc');
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 0,
    buyPrice: 0,
    supplier: '',
  });

  const sortedProcurements = [...procurements].sort((a, b) => {
    if (sortBy === 'date-desc' || sortBy === 'date-asc') {
      const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
      const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
      return sortBy === 'date-desc' ? dateB - dateA : dateA - dateB;
    }
    if (sortBy === 'name-asc') return a.productName.localeCompare(b.productName);
    if (sortBy === 'name-desc') return b.productName.localeCompare(a.productName);
    return 0;
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm">
            <label className="text-xs font-bold text-gray-400 uppercase">Urutkan:</label>
            <select 
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="text-sm font-medium text-gray-600 outline-none bg-transparent"
            >
              <option value="date-desc">Terbaru</option>
              <option value="date-asc">Terlama</option>
              <option value="name-asc">Produk (A-Z)</option>
              <option value="name-desc">Produk (Z-A)</option>
            </select>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Input Pengadaan
          </button>
        </div>
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
              {sortedProcurements.map(p => (
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
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Input Pengadaan</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
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
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex-shrink-0"
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

function SalesManagement({ products, sales, userRole }: { products: Product[], sales: Sale[], userRole?: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'customer-asc' | 'customer-desc'>('date-desc');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customer, setCustomer] = useState('');
  const [address, setAddress] = useState('');
  const [dueDate, setDueDate] = useState('');
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

  const sortedSales = [...filteredSales].sort((a, b) => {
    if (sortBy === 'date-desc' || sortBy === 'date-asc') {
      const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
      const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
      return sortBy === 'date-desc' ? dateB - dateA : dateA - dateB;
    }
    if (sortBy === 'customer-asc') return (a.customer || '').localeCompare(b.customer || '');
    if (sortBy === 'customer-desc') return (b.customer || '').localeCompare(a.customer || '');
    return 0;
  });

  const exportToExcel = () => {
    const data = filteredSales.map(s => ({
      'Tanggal': formatDate(s.date),
      'Jatuh Tempo': s.dueDate ? new Date(s.dueDate).toLocaleDateString('id-ID') : '-',
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
      s.dueDate ? new Date(s.dueDate).toLocaleDateString('id-ID') : '-',
      s.id?.slice(0, 12) || '-',
      s.customer || '-',
      `${s.items.length} item`,
      formatCurrency(s.totalAmount)
    ]);
    
    autoTable(doc, {
      startY: 30,
      head: [['Tanggal', 'Jatuh Tempo', 'ID Transaksi', 'Pelanggan', 'Item', 'Total']],
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
        description: product.description || '',
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
        address,
        dueDate,
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
      setAddress('');
      setDueDate('');
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

  const handleDeleteSale = async (id: string) => {
    console.log('Attempting to delete sale with ID:', id);
    if (!id) {
      toast.error('ID Transaksi tidak ditemukan.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'sales', id));
      toast.success('Transaksi dihapus.');
    } catch (error) {
      console.error('Delete error:', error);
      try {
        handleFirestoreError(error, OperationType.DELETE, `sales/${id}`);
      } catch (errInfo: any) {
        const info = JSON.parse(errInfo.message);
        if (info.error.includes('permission-denied')) {
          toast.error('Akses ditolak. Hanya Admin yang dapat menghapus transaksi.');
        } else {
          toast.error('Gagal menghapus transaksi: ' + info.error);
        }
      }
    }
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
            <label className="text-xs font-bold text-gray-400 uppercase">Urutkan:</label>
            <select 
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="text-sm font-medium text-gray-600 outline-none bg-transparent"
            >
              <option value="date-desc">Terbaru</option>
              <option value="date-asc">Terlama</option>
              <option value="customer-asc">Pelanggan (A-Z)</option>
              <option value="customer-desc">Pelanggan (Z-A)</option>
            </select>
          </div>
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
              {sortedSales.map(s => (
                <tr key={s.id} className="text-sm hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-gray-600">{formatDate(s.date)}</td>
                  <td className="px-4 py-4 font-mono text-xs text-gray-500">{s.id?.slice(0, 8)}...</td>
                  <td className="px-4 py-4 text-gray-900">{s.customer || '-'}</td>
                  <td className="px-4 py-4 text-gray-600">{s.items.length} item</td>
                  <td className="px-4 py-4 font-semibold text-gray-900">{formatCurrency(s.totalAmount)}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setShowInvoice(s)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1"
                        title="Cetak Invoice"
                      >
                        <Printer className="w-4 h-4" />
                        <span className="hidden sm:inline">Invoice</span>
                      </button>
                      {userRole === 'admin' && (
                        <button 
                          onClick={() => setIsDeleteConfirmOpen(s.id!)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Transaksi"
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

      <ConfirmDeleteModal 
        isOpen={!!isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(null)}
        onConfirm={() => isDeleteConfirmOpen && handleDeleteSale(isDeleteConfirmOpen)}
        title="Hapus Transaksi?"
        message="Apakah Anda yakin ingin menghapus transaksi ini? Stok produk tidak akan dikembalikan otomatis."
      />

      {/* Sales Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat (Opsional)</label>
                  <input 
                    type="text" 
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Alamat Pelanggan"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jatuh Tempo (Opsional)</label>
                  <input 
                    type="date" 
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <th className="px-4 py-2">Deskripsi</th>
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
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate" title={item.description}>{item.description || '-'}</td>
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
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Keranjang masih kosong.</td>
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
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Invoice Transaksi</h3>
              <button onClick={() => setShowInvoice(null)} className="p-2 hover:bg-gray-50 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
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
                  {showInvoice.dueDate && (
                    <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">Jatuh Tempo: {new Date(showInvoice.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  )}
                </div>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Ditujukan Kepada:</p>
                  <p className="text-sm font-semibold text-gray-900">{showInvoice.customer || 'Pelanggan Umum'}</p>
                </div>
                {showInvoice.address && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Alamat:</p>
                    <p className="text-sm text-gray-600 leading-tight">{showInvoice.address}</p>
                  </div>
                )}
              </div>

              <table className="w-full text-left mb-8">
                <thead className="border-b-2 border-gray-100">
                  <tr className="text-xs font-bold text-gray-400 uppercase">
                    <th className="py-2">ID Barang</th>
                    <th className="py-2">Item</th>
                    <th className="py-2">Deskripsi</th>
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
                      <td className="py-3 text-[10px] text-gray-500 max-w-[150px] truncate" title={item.description}>{item.description || '-'}</td>
                      <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-600">{formatCurrency(item.price)}</td>
                      <td className="py-3 text-right font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-100">
                  <tr>
                    <td colSpan={5} className="py-4 text-right font-bold text-gray-900">TOTAL</td>
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

                  {/* Visual Signature */}
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none">
                    <img 
                      src="https://lh3.googleusercontent.com/d/1_JmAJCN_dL8QhxnyrYhyGOrdxoJY1hXj" 
                      alt="Signature" 
                      className="w-20 h-12 object-contain"
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
          </div>

          <div className="p-6 bg-gray-50 flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <button 
                onClick={() => downloadPDF(showInvoice)}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              <button 
                onClick={() => window.print()}
                className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <Printer className="w-5 h-5" />
                Cetak
              </button>
              <button 
                onClick={() => setShowInvoice(null)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
                Tutup
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'staff' as 'admin' | 'staff' | 'viewer',
    isMainAdmin: false
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
    }, (error) => {
      console.error('Users Snapshot Error:', error);
      try {
        handleFirestoreError(error, OperationType.GET, 'users');
      } catch (err) {
        // Error already logged
      }
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let registerEmail = formData.email;
      if (!registerEmail.includes('@')) {
        registerEmail = `${registerEmail}@khidmah.com`;
      }

      // Check if user already exists in our local list (Firestore)
      const existingUserInList = users.find(u => u.email.toLowerCase() === registerEmail.toLowerCase());

      if (editingUser || existingUserInList) {
        const targetUid = editingUser?.uid || existingUserInList?.uid;
        if (!targetUid) throw new Error('User ID not found');

        // Update existing user in Firestore
        await updateDoc(doc(db, 'users', targetUid), {
          displayName: formData.displayName,
          role: formData.role,
          password: formData.password,
          isMainAdmin: formData.isMainAdmin,
          isPendingAdmin: false,
          isApprovedViewer: true,
          isPreRegistered: false
        });
        toast.success(editingUser ? 'User berhasil diperbarui!' : 'User sudah terdaftar, data telah diperbarui!');
      } else {
        // Create a unique secondary app instance to avoid "Duplicate App" errors
        const appName = `Secondary-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const secondaryApp = initializeApp(config, appName);
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, registerEmail, formData.password);
          const newUser = userCredential.user;
          
          await setDoc(doc(db, 'users', newUser.uid), {
            uid: newUser.uid,
            displayName: formData.displayName,
            email: registerEmail,
            role: formData.role,
            password: formData.password,
            isMainAdmin: formData.isMainAdmin,
            isPendingAdmin: false, // Admin created users are immediately active
            isApprovedViewer: true,
            isPreRegistered: true, // Allow claiming/linking by any login method
            createdAt: serverTimestamp()
          });

          toast.success('User baru berhasil ditambahkan!');
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use' || authError.message?.includes('auth/email-already-in-use')) {
            // User in Auth but not Firestore - Create a pre-registered profile
            // Use a random ID for now, will be claimed on first login
            await addDoc(collection(db, 'users'), {
              displayName: formData.displayName,
              email: registerEmail,
              role: formData.role,
              password: formData.password,
              isMainAdmin: formData.isMainAdmin,
              isPendingAdmin: false,
              isApprovedViewer: true,
              isPreRegistered: true,
              createdAt: serverTimestamp()
            });
            toast.success('User sudah memiliki akun login. Profil telah disiapkan dan akan aktif saat user login kembali.');
          } else {
            console.error('Auth Error in UserManagement:', authError);
            if (authError.code === 'auth/operation-not-allowed') {
              toast.error('Pendaftaran Email/Password belum diaktifkan di Firebase Console. Silakan aktifkan di menu Authentication > Sign-in method.');
            } else if (authError.code === 'auth/too-many-requests') {
              toast.error('Kecepatan pembuatan akun terlalu tinggi. Mohon tunggu sejenak sebelum membuat akun lagi.');
            } else if (authError.code === 'auth/weak-password') {
              toast.error('Password terlalu lemah. Minimal 6 karakter.');
            } else if (authError.code === 'auth/invalid-email') {
              toast.error('Format email tidak valid.');
            } else {
              toast.error('Gagal membuat akun di Firebase Auth: ' + authError.message);
            }
          }
        } finally {
          try {
            await deleteApp(secondaryApp);
          } catch (e) {
            console.error('Error deleting secondary app:', e);
          }
        }
      }

      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ email: '', password: '', displayName: '', role: 'staff', isMainAdmin: false });
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal memproses user: ' + (error.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: user.password || '',
      displayName: user.displayName,
      role: user.role,
      isMainAdmin: user.isMainAdmin || false
    });
    setIsModalOpen(true);
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

  const handleApproveViewer = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: 'viewer',
        isPendingAdmin: false,
        isApprovedViewer: true
      });
      toast.success('User berhasil disetujui sebagai Viewer!');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyetujui viewer.');
    }
  };

  const handleApproveStaff = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: 'staff',
        isPendingAdmin: false
      });
      toast.success('User berhasil disetujui sebagai Staff!');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyetujui staff.');
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
                <th className="px-4 py-3">Password</th>
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
                        u.role === 'admin' ? "bg-blue-50 text-blue-600" : 
                        u.role === 'viewer' ? "bg-amber-50 text-amber-600" :
                        "bg-gray-50 text-gray-600"
                      )}>
                        {u.role === 'admin' ? 'Admin' : u.role === 'viewer' ? 'Viewer' : 'Staff'}
                        {u.isMainAdmin && ' (Utama)'}
                      </span>
                      {u.isPreRegistered && (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-[10px] font-bold uppercase w-fit">
                          Pre-Registered
                        </span>
                      )}
                      {(u.isPendingAdmin || (u.role === 'viewer' && !u.isApprovedViewer)) && !u.isPreRegistered && (
                        <span className="text-[10px] font-bold text-amber-600 uppercase">Menunggu Persetujuan</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-600 font-mono text-xs">{u.password || '-'}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(u)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {(u.isPendingAdmin || (u.role === 'viewer' && !u.isApprovedViewer)) && (
                        <button 
                          onClick={() => {
                            if (u.role === 'admin') handleApproveAdmin(u.uid);
                            else if (u.role === 'viewer') handleApproveViewer(u.uid);
                            else handleApproveStaff(u.uid);
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Setujui Akses"
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
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">{editingUser ? 'Edit User' : 'Tambah User Baru'}</h3>
              <button onClick={() => { setIsModalOpen(false); setEditingUser(null); }} className="p-2 hover:bg-gray-50 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
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
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Password {editingUser && '(Catatan)'}</label>
                <input 
                  type="text" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  placeholder={editingUser ? "Update catatan password" : "Password baru"}
                />
                {editingUser && <p className="text-[10px] text-amber-600 font-medium ml-1">Catatan: Ini hanya memperbarui tampilan di tabel, tidak merubah password login user.</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Role</label>
                <select 
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as 'admin' | 'staff' | 'viewer'})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="viewer">Viewer (Hanya Lihat Produk)</option>
                </select>
              </div>
              <div className="flex items-center gap-2 px-1 py-2">
                <input 
                  type="checkbox" 
                  id="isMainAdmin"
                  checked={formData.isMainAdmin}
                  onChange={e => setFormData({...formData, isMainAdmin: e.target.checked})}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isMainAdmin" className="text-sm font-bold text-gray-700 cursor-pointer">Jadikan Admin Utama</label>
              </div>
              <div className="flex gap-4 pt-4 flex-shrink-0">
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

function ChangePasswordModal({ isOpen, onClose, user, userProfile }: { isOpen: boolean, onClose: () => void, user: FirebaseUser | null, userProfile: UserProfile | null }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok!');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter!');
      return;
    }

    setIsSubmitting(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password in Auth
      await updatePassword(user, newPassword);
      
      // Update password in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        password: newPassword
      });

      toast.success('Password berhasil diperbarui!');
      onClose();
    } catch (error: any) {
      console.error('Change Password Error:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Password saat ini salah!');
      } else {
        toast.error('Gagal mengganti password: ' + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Ganti Password</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password Saat Ini</label>
            <input 
              type="password" 
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password Baru</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Konfirmasi Password Baru</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-all"
            >
              Batal
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
