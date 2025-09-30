import Router from 'koa-router';
import { MenuController } from '../controllers/MenuController';
import { authMiddleware, familyMemberMiddleware } from '../middlewares/auth';

const router = new Router({
  prefix: '/api/families/:familyId/menus'
});

router.use(authMiddleware);
router.use(familyMemberMiddleware());

// 菜单管理路由
router.get('/', MenuController.getFamilyMenus);
router.post('/', MenuController.createMenu);
router.get('/:menuId', MenuController.getMenuDetails);
router.put('/:menuId', MenuController.updateMenu);
router.delete('/:menuId', MenuController.deleteMenu);

// 菜品管理路由
router.post('/:menuId/dishes', MenuController.addDish);
// router.put('/dishes/:dishId', MenuController.updateDish); // 已移除重复实现，保留主更新接口后续再启用
router.delete('/dishes/:dishId', MenuController.removeDish);

// 投票相关路由
router.post('/:menuId/dishes/:dishId/vote', MenuController.voteForDish);
router.get('/:menuId/votes', MenuController.getUserVotes);

// 菜单状态管理路由
router.post('/:menuId/start-voting', MenuController.startVoting);
router.post('/:menuId/finalize', MenuController.finalizeMenu);

// 统计和分析路由
router.get('/:menuId/statistics', MenuController.getMenuStatistics);
router.get('/:menuId/result', MenuController.getFinalOrderResult);
router.get('/:menuId/export', MenuController.exportOrderResult);

// 家庭偏好分析路由
router.get('/family/preferences', MenuController.getFamilyPreferences);

export default router;
