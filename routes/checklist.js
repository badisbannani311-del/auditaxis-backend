const express = require('express');
const router = express.Router();

// Stockage en mémoire avec Map
const sessions = new Map();

// Génération d'ID simple
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * POST /api/checklist/save
 * Sauvegarde une checklist et retourne un ID de session
 */
router.post('/save', (req, res) => {
    const { norme, items, progression } = req.body;

    // Validation des données
    if (!norme || typeof norme !== 'string') {
        return res.status(400).json({
            error: 'NORME_MANQUANTE',
            message: 'La norme est requise',
        });
    }

    if (!items || typeof items !== 'object') {
        return res.status(400).json({
            error: 'ITEMS_MANQUANTS',
            message: 'Les items de la checklist sont requis',
        });
    }

    // Création de la session
    const sessionId = generateId();
    const sessionData = {
        norme,
        items,
        progression: progression || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    // Stockage en mémoire
    sessions.set(sessionId, sessionData);

    console.log(`✅ Checklist sauvegardée - Session: ${sessionId}, Norme: ${norme}`);

    res.json({
        success: true,
        sessionId,
        data: sessionData,
    });
});

/**
 * GET /api/checklist/:sessionId
 * Récupère une checklist par son ID de session
 */
router.get('/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({
            error: 'SESSION_ID_INVALIDE',
            message: 'L\'identifiant de session est requis',
        });
    }

    const sessionData = sessions.get(sessionId);

    if (!sessionData) {
        return res.status(404).json({
            error: 'SESSION_NON_TROUVEE',
            message: 'Session de checklist non trouvée',
        });
    }

    console.log(`📋 Checklist récupérée - Session: ${sessionId}`);

    res.json({
        success: true,
        sessionId,
        data: sessionData,
    });
});

// Export du routeur et de la Map pour usage externe si nécessaire
module.exports = router;
module.exports.sessions = sessions;
