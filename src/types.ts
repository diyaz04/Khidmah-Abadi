export type Category = 'Barang' | 'Pangan';

export interface Product {
  id?: string;
  sku: string;
  name: string;
  category: Category;
  price: number;
  stock: number;
  unit: string;
  description?: string;
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
  address?: string;
  dueDate?: string; // ISO Date string
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'admin' | 'staff' | 'viewer';
  isMainAdmin?: boolean;
  isPendingAdmin?: boolean;
}
