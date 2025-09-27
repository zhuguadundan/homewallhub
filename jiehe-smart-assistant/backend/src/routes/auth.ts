import Router from 'koa-router';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = new Router({
  prefix: '/api/auth'
});

// 公共路由（不需要认证）
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);

// 需要认证的路由
router.get('/profile', authMiddleware, AuthController.getProfile);
router.put('/profile', authMiddleware, AuthController.updateProfile);
router.put('/password', authMiddleware, AuthController.changePassword);
router.post('/logout', authMiddleware, AuthController.logout);

export default router;