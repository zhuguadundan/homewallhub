import Router from 'koa-router';
import { MessageController } from '../controllers/MessageController';
import { authMiddleware } from '../middlewares/auth';
import { errorHandler } from '../middlewares/errorHandler';

const router = new Router({
  prefix: '/api/messages'
});

// 应用中间件
router.use(errorHandler);
router.use(authMiddleware);

// 基础留言管理路由
router.get('/', MessageController.getMessageList);
router.post('/', MessageController.createMessage);
router.get('/:messageId', MessageController.getMessageDetail);
router.put('/:messageId', MessageController.updateMessage);
router.delete('/:messageId', MessageController.deleteMessage);

// 留言交互路由
router.post('/:messageId/reaction', MessageController.addReaction);
router.post('/:messageId/read', MessageController.markAsRead);

// 统计和批量操作路由
router.get('/stats/overview', MessageController.getMessageStats);
router.get('/unread/count', MessageController.getUnreadCount);
router.post('/read/all', MessageController.markAllAsRead);

export default router;