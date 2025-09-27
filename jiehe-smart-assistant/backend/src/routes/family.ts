import Router from 'koa-router';
import { FamilyController } from '../controllers/familyController';
import { authMiddleware, familyMemberMiddleware } from '../middlewares/auth';

const router = new Router({
  prefix: '/api/families'
});

// 需要认证的路由
router.use(authMiddleware);

// 家庭相关路由
router.post('/', FamilyController.createFamily);
router.post('/join', FamilyController.joinFamily);
router.get('/my', FamilyController.getUserFamilies);

// 需要家庭成员权限的路由
router.get('/:familyId', familyMemberMiddleware(), FamilyController.getFamilyDetails);
router.put('/:familyId', familyMemberMiddleware('admin'), FamilyController.updateFamily);
router.get('/:familyId/members', familyMemberMiddleware(), FamilyController.getFamilyMembers);
router.put('/:familyId/members/permissions', familyMemberMiddleware('admin'), FamilyController.updateMemberPermissions);
router.delete('/:familyId/members/:userId', familyMemberMiddleware('admin'), FamilyController.removeMember);
router.post('/:familyId/leave', familyMemberMiddleware(), FamilyController.leaveFamily);

export default router;