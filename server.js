Voici le code complet et nettoyé de votre fichier server.js, débarrassé des numéros de ligne et des sauts de ligne intempestifs. Vous pouvez le copier-coller directement :

JavaScript
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────
// CORS — uniquement le frontend autorisé
// ─────────────────────────────────────────────

app.use(cors({
    origin: [
        'https://auditaxis-frontend.vercel.app',
        'https://auditaxis-qse.com',
        'http://localhost:8000',
        'http://localhost:3000',
        'http://127.0.0.1:8000',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true,
}));

app.options('*', cors());
app.use(express.json());

// ─────────────────────────────────────────────
// RATE LIMITERS
// ─────────────────────────────────────────────

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'RATE_LIMIT', message: 'Trop de requêtes. Réessayez plus tard.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(globalLimiter);

const diagnosticLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'RATE_LIMIT_STRICT', message: 'Limite diagnostic atteinte. Réessayez dans 15 min.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─────────────────────────────────────────────
// Import des routes
// ─────────────────────────────────────────────

const diagnosticRouter = require('./routes/diagnostic');
const checklistRouter = require('./routes/checklist');

app.use('/api/diagnostic', diagnosticLimiter, diagnosticRouter);
app.use('/api/checklist', checklistRouter);

// ─────────────────────────────────────────────
// POST /api/contact — Envoi d'email avec Nodemailer
// ─────────────────────────────────────────────

app.post('/api/contact', async (req, res) => {
    const { nom, email, sujet, message, company } = req.body;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!nom || typeof nom !== 'string' || nom.trim().length < 2) {
        return res.status(400).json({ error: 'NOM_INVALIDE', message: 'Nom requis (min 2 caractères)' });
    }
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'EMAIL_INVALIDE', message: 'Email invalide' });
    }
    if (!sujet || typeof sujet !== 'string' || sujet.trim().length < 5) {
        return res.status(400).json({ error: 'SUJET_INVALIDE', message: 'Sujet requis (min 5 caractères)' });
    }
    if (!message || typeof message !== 'string' || message.trim().length < 20) {
        return res.status(400).json({ error: 'MESSAGE_INVALIDE', message: 'Message requis (min 20 caractères)' });
    }

    console.log('📧 Message de ' + nom + ' (' + email + ') — Sujet: ' + sujet);

    // Si SMTP non configuré → réponse succès sans envoi
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ SMTP non configuré — email non envoyé');
        return res.json({
            success: true,
            message: 'Message reçu (SMTP non configuré sur Render)',
        });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const emailTo = process.env.EMAIL_TO || process.env.EMAIL_USER;

        // Email à l'admin
        await transporter.sendMail({
            from: '"AuditAxis QSE" <' + process.env.EMAIL_USER + '>',
            replyTo: email,
            to: emailTo,
            subject: '[AuditAxis] ' + sujet,
            html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">' +
                '<h2 style="color:#1e5f8c;border-bottom:2px solid #2e8b57;padding-bottom:10px;">Nouveau message de contact</h2>' +
                '<table style="width:100%;border-collapse:collapse;margin:20px 0;">' +
                '<tr><td style="padding:8px;font-weight:bold;color:#1e5f8c;width:140px;">Nom</td><td style="padding:8px;">' + nom + '</td></tr>' +
                '<tr><td style="padding:8px;font-weight:bold;color:#1e5f8c;">Email</td><td style="padding:8px;">' + email + '</td></tr>' +
                (company ? '<tr><td style="padding:8px;font-weight:bold;color:#1e5f8c;">Entreprise</td><td style="padding:8px;">' + company + '</td></tr>' : '') +
                '<tr><td style="padding:8px;font-weight:bold;color:#1e5f8c;">Date</td><td style="padding:8px;">' + new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Algiers' }) + '</td></tr>' +
                '</table>' +
                '<h3 style="color:#1e5f8c;">Message</h3>' +
                '<div style="background:#f4f6f9;padding:15px;border-left:4px solid #2e8b57;border-radius:4px;">' +
                '<p style="white-space:pre-wrap;line-height:1.6;">' + message + '</p>' +
                '</div></div>',
        });

        // Email de confirmation à l'expéditeur
        await transporter.sendMail({
            from: '"AuditAxis QSE" <' + process.env.EMAIL_USER + '>',
            to: email,
            subject: '✅ Message reçu — AuditAxis QSE',
            html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">' +
                '<h2 style="color:#2e8b57;">Merci, ' + nom + ' !</h2>' +
                '<p>Nous avons reçu votre message et vous répondrons sous 24h.</p>' +
                '<div style="background:#f4f6f9;padding:15px;border-left:4px solid #1e5f8c;border-radius:4px;margin:20px 0;">' +
                '<strong>Sujet :</strong> <em>' + sujet + '</em></div>' +
                '<p>L\'équipe <strong>AuditAxis QSE</strong></p></div>',
        });

        console.log('✅ Emails envoyés avec succès');
        res.json({ success: true, message: 'Message envoyé avec succès' });
    } catch (error) {
        console.error('❌ Erreur envoi email:', error.message);
        res.status(500).json({
            error: 'EMAIL_SEND_FAILED',
            message: 'Impossible d\'envoyer votre message. Réessayez plus tard.',
        });
    }
});

// ─────────────────────────────────────────────
// Route de santé
// ─────────────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        email: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    });
});

// Route racine
app.get('/', (req, res) => {
    res.json({
        name: 'AuditAxis QSE Backend',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            diagnostic: '/api/diagnostic',
            checklist: '/api/checklist',
            contact: '/api/contact',
        },
    });
});

// ─────────────────────────────────────────────
// 404 + Gestionnaire d'erreurs
// ─────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({
        error: 'ROUTE_NON_TROUVEE',
        message: 'Route non trouvée',
        path: req.path,
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Erreur:', err);

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'JSON_INVALIDE', message: 'JSON invalide' });
    }

    if (err.status === 401 || err.message?.includes('GEMINI_AUTH_ERROR')) {
        return res.status(401).json({ error: 'AUTH_ERROR', message: "Erreur d'authentification IA" });
    }

    if (err.status === 429 || err.message?.includes('GEMINI_RATE_LIMIT')) {
        return res.status(429).json({ error: 'RATE_LIMIT', message: 'Trop de requêtes IA' });
    }

    res.status(err.status || 500).json({
        error: 'ERREUR_SERVEUR',
        message: process.env.NODE_ENV === 'production' ? 'Une erreur est survenue' : err.message,
    });
});

// ─────────────────────────────────────────────
// Démarrage
// ─────────────────────────────────────────────

app.listen(PORT, () => {
    console.log('🚀 Serveur AuditAxis QSE démarré sur le port ' + PORT);
    console.log('🔧 Environnement: ' + (process.env.NODE_ENV || 'development'));
    console.log('📧 SMTP: ' + (process.env.EMAIL_USER ? '✅' : '⚠️ non configuré'));
});

module.exports = app;
