/**
 * AI路由配置
 * 定义AI相关的API端点
 */

import Router from 'koa-router';
import { AIController } from '../controllers/AIController';
import { authMiddleware } from '../middlewares/auth';

const router = new Router({
  prefix: '/api/ai'
});

// 所有AI路由都需要认证
router.use(authMiddleware);

// AI请求需要特殊的速率限制（暂时使用空中间件，稍后实现）
const aiRateLimit = async (ctx: any, next: any) => await next();

/**
 * @route POST /api/ai/request
 * @desc 通用AI请求接口
 * @access Private
 */
router.post('/request', aiRateLimit, AIController.makeRequest);

/**
 * @route POST /api/ai/recipe-recommendation
 * @desc 获取食谱推荐
 * @access Private
 */
router.post('/recipe-recommendation', aiRateLimit, AIController.getRecipeRecommendation);

/**
 * @route POST /api/ai/task-suggestion
 * @desc 获取任务建议
 * @access Private
 */
router.post('/task-suggestion', aiRateLimit, AIController.getTaskSuggestion);

/**
 * @route POST /api/ai/shopping-list
 * @desc 生成智能购物清单
 * @access Private
 */
router.post('/shopping-list', aiRateLimit, AIController.generateShoppingList);

/**
 * @route GET /api/ai/budget/usage
 * @desc 获取预算使用情况
 * @access Private
 */
router.get('/budget/usage', AIController.getBudgetUsage);

/**
 * @route GET /api/ai/budget/records
 * @desc 获取使用记录
 * @access Private
 */
router.get('/budget/records', AIController.getUsageRecords);

/**
 * @route GET /api/ai/cache/stats
 * @desc 获取缓存统计
 * @access Private
 */
router.get('/cache/stats', AIController.getCacheStats);

/**
 * @route DELETE /api/ai/cache
 * @desc 清理缓存
 * @access Private
 */
router.delete('/cache', AIController.clearCache);

/**
 * @route GET /api/ai/rate-limit/status
 * @desc 获取速率限制状态
 * @access Private
 */
router.get('/rate-limit/status', AIController.getRateLimitStatus);

/**
 * @route GET /api/ai/status
 * @desc 获取AI服务整体状态
 * @access Private
 */
router.get('/status', AIController.getServiceStatus);

export default router;