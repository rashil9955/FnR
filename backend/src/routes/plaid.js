import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createLinkToken, exchangePublicToken, handleWebhook } from '../services/plaidService.js';

const router = Router();

router.post('/create_link_token', requireAuth, createLinkToken);
router.post('/exchange_public_token', requireAuth, exchangePublicToken);
router.post('/webhook', handleWebhook);

export default router;
