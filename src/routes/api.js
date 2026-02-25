
import { Router } from 'express';
import { aggregate } from '../services/aggregator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/resumo', asyncHandler(async (req, res) => {
  const period = req.query.period || null;
  const data = await aggregate({ period, householdId: req.currentHousehold?.id });
  res.json(data);
}));

export default router;
