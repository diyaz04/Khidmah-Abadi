export type Category = 'Barang' | 'Pangan' | 'Jasa' | 'Buah-buahan' | 'Susu' | 'Roti' | 'Keringan' | 'Sayuran' | 'Bumbu Pelengkap masak';

export interface Product {
  id?: string;
  sku: string;
  name: string;
  category: Category;
  price: number;
  stock: number;
  unit: string;
  description?: string;
  imageUrl?: string;
  createdAt?: any; // Firestore Timestamp
}

export interface Procurement {
  id?: string;
  productId: string;
  sku: string;
  productName: string;
  category: Category;
  quantity: number;
  buyPrice: number;
  supplier: string;
  date: any; // Firestore Timestamp
}

export interface SaleItem {
  productId: string;
  sku: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Sale {
  id?: string;
  items: SaleItem[];
  totalAmount: number;
  date: any; // Firestore Timestamp
  customer?: string;
  customerId?: string;
  address?: string;
  phone?: string;
  dueDate?: string; // ISO Date string
}

export interface Customer {
  id?: string;
  name: string;
  address: string;
  phone: string;
  createdAt?: any;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'admin' | 'staff' | 'viewer';
  isMainAdmin?: boolean;
  isPendingAdmin?: boolean;
  isApprovedViewer?: boolean;
  isPreRegistered?: boolean;
  lastLogin?: any;
  password?: string;
}
