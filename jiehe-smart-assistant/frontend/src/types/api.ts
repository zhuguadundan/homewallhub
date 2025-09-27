// API响应通用接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  timestamp: string;
  path: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  nickname?: string;
  avatar?: string;
  phone?: string;
  gender: number;
  birthday?: string;
  preferences?: any;
  created_at: string;
  last_login_at?: string;
  families?: Family[];
  currentFamily?: Family;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  nickname?: string;
  phone?: string;
  gender?: number;
  birthday?: string;
}

export interface LoginData {
  identifier: string;
  password: string;
}

export interface UpdateProfileData {
  nickname?: string;
  phone?: string;
  gender?: number;
  birthday?: string;
  preferences?: any;
}

export interface ChangePasswordData {
  oldPassword: string;
  newPassword: string;
}

// 认证相关类型
export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

// 家庭相关类型
export interface Family {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  role?: string;
  joined_at?: string;
  member_nickname?: string;
}

export interface CreateFamilyData {
  name: string;
  description?: string;
  avatar?: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'child';
  nickname?: string;
  permissions?: any;
  joined_at: string;
  user?: Partial<User>;
}// 任务相关类型
export interface Task {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  category: string;
  priority: 1 | 2 | 3;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: string;
  created_by: string;
  due_date?: string;
  completed_at?: string;
  estimated_minutes: number;
  actual_minutes?: number;
  recurrence_rule?: any;
  tags?: string;
  attachments?: any;
  created_at: string;
  updated_at: string;
  assignee?: Partial<User>;
  creator?: Partial<User>;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  category?: string;
  priority?: 1 | 2 | 3;
  assigned_to?: string;
  due_date?: string;
  estimated_minutes?: number;
  tags?: string;
}

// 库存相关类型
export interface FoodCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  sort_order: number;
}

export interface FoodItem {
  id: string;
  name: string;
  category_id: string;
  barcode?: string;
  unit: string;
  default_expire_days: number;
  nutrition_info?: any;
  image?: string;
  description?: string;
  category?: FoodCategory;
}

export interface Inventory {
  id: string;
  family_id: string;
  food_item_id: string;
  batch_number?: string;
  quantity: number;
  unit: string;
  purchase_date: string;
  expire_date?: string;
  purchase_price?: number;
  location: string;
  status: 'available' | 'expired' | 'consumed' | 'running_low';
  notes?: string;
  added_by: string;
  created_at: string;
  food_item?: FoodItem;
  adder?: Partial<User>;
}

export interface AddInventoryData {
  food_item_id: string;
  quantity: number;
  unit: string;
  purchase_date?: string;
  expire_date?: string;
  purchase_price?: number;
  location?: string;
  notes?: string;
}

// 菜谱和菜单相关类型
export interface Recipe {
  id: string;
  name: string;
  description?: string;
  category: string;
  difficulty: 1 | 2 | 3;
  prep_time: number;
  cook_time: number;
  servings: number;
  ingredients?: any;
  steps?: any;
  nutrition?: any;
  image?: string;
  tags?: string;
  source?: string;
  created_by?: string;
}

export interface FamilyMenu {
  id: string;
  family_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  title?: string;
  description?: string;
  created_by: string;
  voting_deadline?: string;
  status: 'voting' | 'confirmed' | 'completed';
  options?: MenuOption[];
  creator?: Partial<User>;
}

export interface MenuOption {
  id: string;
  menu_id: string;
  recipe_id: string;
  suggested_by: string;
  vote_count: number;
  notes?: string;
  recipe?: Recipe;
  suggester?: Partial<User>;
  votes?: MenuVote[];
}

export interface MenuVote {
  id: string;
  menu_option_id: string;
  user_id: string;
  vote_type: 'like' | 'love' | 'dislike';
  created_at: string;
  user?: Partial<User>;
}