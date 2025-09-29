import { createRouter, createWebHistory } from 'vue-router'
import { showToast } from 'vant'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: {
      title: '登录',
      requiresAuth: false
    }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: {
      title: '注册',
      requiresAuth: false
    }
  },
  {
    path: '/',
    component: () => import('@/layouts/TabLayout.vue'),
    meta: {
      requiresAuth: true
    },
    children: [
      {
        path: '',
        redirect: '/home'
      },
      {
        path: 'home',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: {
          title: '首页',
          keepAlive: true
        }
      },
      {
        path: 'family',
        name: 'Family',
        component: () => import('@/views/family/Index.vue'),
        meta: {
          title: '家庭管理',
          keepAlive: true
        }
      },
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('@/views/Tasks/Index.vue'),
        meta: {
          title: '任务看板',
          keepAlive: true
        }
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('@/views/Inventory/Index.vue'),
        meta: {
          title: '物品清单',
          keepAlive: true
        }
      },
      {
        path: 'calendar',
        name: 'Calendar',
        component: () => import('@/views/Calendar/Index.vue'),
        meta: {
          title: '家庭日历',
          keepAlive: true
        }
      },
      {
        path: 'ai',
        name: 'AI',
        component: () => import('@/views/AI/Index.vue'),
        meta: {
          title: 'AI助手',
          keepAlive: true
        }
      },
      {
        path: 'messages',
        name: 'Messages',
        component: () => import('@/views/Message/Index.vue'),
        meta: {
          title: '家庭消息',
          keepAlive: true
        }
      },
      {
        path: 'analytics',
        name: 'Analytics',
        component: () => import('@/views/Analytics/Index.vue'),
        meta: {
          title: '数据分析',
          keepAlive: true
        }
      }
    ]
  },
  {
    path: '/family/create',
    name: 'CreateFamily',
    component: () => import('@/views/family/Create.vue'),
    meta: {
      title: '创建家庭',
      requiresAuth: true
    }
  },
  {
    path: '/family/join',
    name: 'JoinFamily',
    component: () => import('@/views/family/Join.vue'),
    meta: {
      title: '加入家庭',
      requiresAuth: true
    }
  },
  {
    path: '/family/settings',
    name: 'FamilySettings',
    component: () => import('@/views/family/Settings.vue'),
    meta: {
      title: '家庭设置',
      requiresAuth: true
    }
  },
  {
    path: '/tasks/create',
    name: 'CreateTask',
    component: () => import('@/views/Tasks/Create.vue'),
    meta: {
      title: '创建任务',
      requiresAuth: true
    }
  },
  {
    path: '/tasks/:id',
    name: 'TaskDetail',
    component: () => import('@/views/Tasks/Detail.vue'),
    meta: {
      title: '任务详情',
      requiresAuth: true
    }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile/Index.vue'),
    meta: {
      title: '个人中心',
      requiresAuth: true
    }
  },
  {
    path: '/ai/recipe-recommendation',
    name: 'RecipeRecommendation',
    component: () => import('@/views/AI/RecipeRecommendation.vue'),
    meta: {
      title: '菜谱推荐',
      requiresAuth: true
    }
  },
  {
    path: '/ai/task-suggestion',
    name: 'TaskSuggestion',
    component: () => import('@/views/AI/TaskSuggestion.vue'),
    meta: {
      title: '任务建议',
      requiresAuth: true
    }
  },
  {
    path: '/ai/smart-shopping',
    name: 'SmartShopping',
    component: () => import('@/views/AI/SmartShopping.vue'),
    meta: {
      title: '智能购物清单',
      requiresAuth: true
    }
  },
  {
    path: '/analytics/inventory',
    name: 'InventoryAnalysis',
    component: () => import('@/views/Analytics/InventoryAnalysis.vue'),
    meta: {
      title: '库存分析',
      requiresAuth: true
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: '页面不存在'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})// 路由守卫
router.beforeEach(async (to, from, next) => {
  // 设置页面标题
  if (to.meta?.title) {
    document.title = `${to.meta.title} - 家和智能助手`
  }
  
  // 检查是否需要认证
  if (to.meta?.requiresAuth !== false) {
    // 动态导入避免循环依赖
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    
    // 如果用户还没有认证状态，尝试从本地存储恢复
    if (!authStore.isAuthenticated) {
      try {
        const success = await authStore.initializeAuth()
        if (!success) {
          showToast('请先登录')
          next({
            name: 'Login',
            query: { redirect: to.fullPath }
          })
          return
        }
      } catch (error) {
        console.error('认证初始化失败:', error)
        showToast('认证失败，请重新登录')
        next({
          name: 'Login',
          query: { redirect: to.fullPath }
        })
        return
      }
    }
    
    // 已登录用户访问登录/注册页面，重定向到首页
    if (authStore.isAuthenticated && ['Login', 'Register'].includes(to.name as string)) {
      next({ name: 'Home' })
      return
    }
  }
  
  // 检查家庭权限
  if (to.meta?.requiresFamily) {
    const userStore = useUserStore()
    if (!userStore.currentFamily) {
      showToast('请先创建或加入家庭')
      next({ name: 'Family' })
      return
    }
  }
  
  next()
})

export default router