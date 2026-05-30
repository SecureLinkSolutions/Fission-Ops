import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import * as repo from '../repositories/notificationRepository';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const notifications = await repo.getUserNotifications(req.user!.sub);
  res.json(notifications);
});

router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  const count = await repo.getUnreadCount(req.user!.sub);
  res.json({ count });
});

router.patch('/:id/read', authenticate, async (req: Request, res: Response) => {
  await repo.markRead(req.params.id, req.user!.sub);
  res.json({ ok: true });
});

router.patch('/read-all', authenticate, async (req: Request, res: Response) => {
  await repo.markAllRead(req.user!.sub);
  res.json({ ok: true });
});

export default router;
