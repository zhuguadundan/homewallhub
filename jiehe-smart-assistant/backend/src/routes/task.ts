import Router from 'koa-router';
import { TaskController } from '../controllers/taskController';
import { authMiddleware, familyMemberMiddleware } from '../middlewares/auth';

const router = new Router({
  prefix: '/api'
});

// 需要认证的路由
router.use(authMiddleware);

// 用户任务相关路由
router.get('/tasks/my', TaskController.getUserTasks);

// 家庭任务相关路由 - 需要家庭成员权限
router.post('/families/:familyId/tasks', familyMemberMiddleware(), TaskController.createTask);
router.get('/families/:familyId/tasks', familyMemberMiddleware(), TaskController.getFamilyTasks);
router.get('/families/:familyId/tasks/statistics', familyMemberMiddleware(), TaskController.getFamilyStatistics);
router.get('/families/:familyId/tasks/upcoming', familyMemberMiddleware(), TaskController.getUpcomingTasks);

// 单个任务操作路由
router.get('/tasks/:taskId', TaskController.getTaskDetails);
router.put('/tasks/:taskId', TaskController.updateTask);
router.delete('/tasks/:taskId', TaskController.deleteTask);
router.put('/tasks/:taskId/assign', TaskController.assignTask);
router.put('/tasks/:taskId/status', TaskController.updateTaskStatus);

// 批量操作路由
router.put('/tasks/batch/status', TaskController.batchUpdateStatus);

export default router;