import Router from 'koa-router';
import { InventoryController } from '../controllers/InventoryController';
import { authMiddleware, familyMemberMiddleware } from '../middlewares/auth';

const router = new Router({
  prefix: '/api/families/:familyId/inventory'
});

// 所有库存路由都需要认证
router.use(authMiddleware);
router.use(familyMemberMiddleware());

// 库存物品相关路由
router.post('/', InventoryController.createItem);                    // 创建库存物品
router.get('/', InventoryController.getFamilyItems);                // 获取家庭库存列表
router.get('/statistics', InventoryController.getStatistics);        // 获取库存统计
router.get('/expiring', InventoryController.getExpiringItems);       // 获取即将过期物品
router.get('/low-stock', InventoryController.getLowStockItems);      // 获取库存不足物品

// 库存分类相关路由
router.get('/categories', InventoryController.getCategories);        // 获取库存分类
router.post('/categories', InventoryController.createCategory);      // 创建库存分类

// 单个库存物品相关路由
router.get('/:itemId', InventoryController.getItemDetails);          // 获取库存物品详情
router.put('/:itemId', InventoryController.updateItem);              // 更新库存物品
router.delete('/:itemId', InventoryController.deleteItem);           // 删除库存物品

// 库存操作相关路由
router.post('/:itemId/add-stock', InventoryController.addStock);     // 库存入库
router.post('/:itemId/consume', InventoryController.consumeStock);   // 库存出库

export default router;