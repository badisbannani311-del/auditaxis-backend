const express = require('express');
const router = express.Router();
const { analyserDiagnostic } = require('../services/gemini');

// Normes ISO valides
const NORMES_VALIDES = [
    'ISO 9001:2015',
    'ISO 14001:2015',
    'ISO 45001:2018',
];

/**
 * POST /api/diagnostic
 * Analyse un diagnostic QSE avec l'API Gemini
 */
router.post('/', async (req, res, next) => {
    try {
        const { norme, description } = req.body;

        // Validation de la norme
        if (!norme || !NORMES_VALIDES.includes(norme)) {
            return res.status(400).json({
                error: 'NORME_INVALIDE',
                message: `La norme doit être l'une des suivantes: ${NORMES_VALIDES.join(', ')}`,
            });
        }

        // Validation de la description
        if (!description || typeof description !== 'string') {
            return res.status(400).json({
                error: 'DESCRIPTION_MANQUANTE',
                message: 'La description est requise',
            });
        }

        const longueur = description.trim().length;

        if (longueur < 50) {
            return res.status(400).json({
                error: 'DESCRIPTION_TROP_COURTE',
                message: 'La description doit contenir au moins 50 caractères',
            });
        }

        if (longueur > 2000) {
            return res.status(400).json({
                error: 'DESCRIPTION_TROP_LONGUE',
                message: 'La description ne doit pas dépasser 2000 caractères',
            });
        }

        // Appel au service Gemini
        const resultat = await analyserDiagnostic(norme, description);

        res.json({
            success: true,
            data: resultat,
        });
    } catch (error) {
        // Gestion des erreurs spécifiques du service Gemini
        if (error.message?.includes('GEMINI_AUTH_ERROR')) {
            return res.status(401).json({
                error: 'AUTH_ERROR',
                message: 'Erreur d\'authentification avec le service d\'analyse',
            });
        }

        if (error.message?.includes('GEMINI_RATE_LIMIT')) {
            return res.status(429).json({
                error: 'RATE_LIMIT',
                message: 'Trop de requêtes. Veuillez réessayer dans quelques instants.',
            });
        }

        if (error.message?.includes('JSON_PARSE_ERROR')) {
            return res.status(500).json({
                error: 'PARSE_ERROR',
                message: 'Erreur lors du traitement de la réponse d\'analyse',
            });
        }

        next(error);
    }
});

module.exports = router;
