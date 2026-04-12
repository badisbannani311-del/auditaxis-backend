const express = require('express');
const router = express.Router();

// Regex pour validation email
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/contact
 * Valide et log un message de contact
 */
router.post('/', (req, res) => {
    const { nom, email, sujet, message } = req.body;

    // Validation du nom
    if (!nom || typeof nom !== 'string' || nom.trim().length === 0) {
        return res.status(400).json({
            error: 'NOM_MANQUANT',
            message: 'Le nom est requis',
        });
    }

    // Validation de l'email
    if (!email || typeof email !== 'string') {
        return res.status(400).json({
            error: 'EMAIL_MANQUANT',
            message: 'L\'email est requis',
        });
    }

    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({
            error: 'EMAIL_INVALIDE',
            message: 'L\'email n\'est pas valide',
        });
    }

    // Validation du sujet
    if (!sujet || typeof sujet !== 'string' || sujet.trim().length === 0) {
        return res.status(400).json({
            error: 'SUJET_MANQUANT',
            message: 'Le sujet est requis',
        });
    }

    // Validation du message (minimum 20 caractères)
    if (!message || typeof message !== 'string') {
        return res.status(400).json({
            error: 'MESSAGE_MANQUANT',
            message: 'Le message est requis',
        });
    }

    if (message.trim().length < 20) {
        return res.status(400).json({
            error: 'MESSAGE_TROP_COURT',
            message: 'Le message doit contenir au moins 20 caractères',
        });
    }

    // Log en console
    console.log('📧 Nouveau message de contact:');
    console.log(`   De: ${nom} (${email})`);
    console.log(`   Sujet: ${sujet}`);
    console.log(`   Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
    console.log(`   Date: ${new Date().toISOString()}`);
    console.log('---');

    res.json({
        success: true,
        message: 'Message reçu avec succès',
    });
});

module.exports = router;
