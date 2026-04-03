import { Router } from 'express';

const router = Router();

router.use((_req, res) => {
  res.status(410).json({
    status: 'error',
    code: 'legacy_route_removed',
    message: 'This legacy route has been removed from ZeroDay Guardian.',
  });
});

export default router;
