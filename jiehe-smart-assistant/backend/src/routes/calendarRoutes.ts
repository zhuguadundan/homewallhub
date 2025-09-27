import Router from 'koa-router';
import { CalendarController } from '../controllers/CalendarController';
import { authMiddleware } from '../middlewares/auth';
import { errorHandler } from '../middlewares/errorHandler';

const router = new Router({
  prefix: '/api/calendar'
});

// 应用中间件
router.use(errorHandler);
router.use(authMiddleware);

// 基础事件管理路由
router.get('/events', CalendarController.getEventList);
router.post('/events', CalendarController.createEvent);
router.get('/events/:eventId', CalendarController.getEventDetails);
router.put('/events/:eventId', CalendarController.updateEvent);
router.delete('/events/:eventId', CalendarController.deleteEvent);

// 参与状态管理
router.put('/events/:eventId/participation', CalendarController.updateParticipationStatus);

// 统计和分析路由
router.get('/stats', CalendarController.getCalendarStats);
router.get('/today', CalendarController.getTodayEvents);
router.get('/upcoming', CalendarController.getUpcomingEvents);

// 提醒管理路由
router.post('/events/:eventId/reminders', CalendarController.createEventReminder);
router.get('/reminders/stats', CalendarController.getReminderStats);
router.post('/reminders/trigger', CalendarController.triggerReminderCheck);

export default router;