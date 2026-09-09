const express = require('express');
const { auth } = require('../middleware/auth');
const copilotService = require('../services/copilot-service');

const router = express.Router();

// Autenticação obrigatória (vendedores ou administradores)
router.use(auth);

// Retorna as ferramentas disponíveis e metadados
router.get('/tools', (req, res) => {
    res.json({
        tools: copilotService.TOOLS_SPEC,
        user: {
            id: req.user.id,
            name: req.user.name,
            role: req.user.role
        }
    });
});

// Processa uma mensagem do usuário com orquestração de tools e IA
router.post('/message', async (req, res, next) => {
    try {
        const { message, conversationHistory } = req.body;
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'Mensagem não pode ser vazia.' });
        }

        const result = await copilotService.processMessage({
            message: message.trim(),
            conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
            userContext: {
                id: req.user.id,
                name: req.user.name,
                role: req.user.role,
                organization_id: req.user.organization_id || 1
            }
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// Execução direta de uma tool pelo front-end (ex: via botão de atalho)
router.post('/execute-tool', async (req, res, next) => {
    try {
        const { name, args } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Nome da tool é obrigatório.' });
        }

        const result = await copilotService.executeTool(name, args || {}, {
            id: req.user.id,
            name: req.user.name,
            role: req.user.role,
            organization_id: req.user.organization_id || 1
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
