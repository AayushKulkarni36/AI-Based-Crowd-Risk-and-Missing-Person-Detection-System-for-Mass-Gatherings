import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { processMessage } from '../services/nlp.service.js';

const router = express.Router();

// POST /api/chat
router.post('/', requireAuth, async (req, res) => {
    try {
        const { message, language = 'en' } = req.body;

        if (!message || message.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be under 500 characters.'
            });
        }

        const response = await processMessage(message, language);

        return res.json({
            success: true,
            ...response,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error processing chat message'
        });
    }
});

export default router;
