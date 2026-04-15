require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────
// CONFIGURATION CORS
// ─────────────────────────────────────────────

app.use(cors({
    origin: [
        'https://auditaxis-frontend.vercel.app',
        'https://auditaxis-qse.com',
        'http://localhost:8000',
        'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true,
}));

app.use(express.json());

// ─────────────────────────────────────────────
// LIMITATION DU DÉBIT (RATE LIMIT)
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
// ROUTES
// ─────────────────────────────────────────────

const diagnosticRouter = require('./routes/diagnostic');
const checklistRouter = require('./routes/checklist');

app.use('/api/diagnostic', diagnosticLimiter, diagnosticRouter);
app.use('/api/checklist', checklistRouter);

// ─────────────────────────────────────────────
// CONTACT / ENVOI D'EMAIL
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

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ SMTP non configuré — email non envoyé');
        return res.json({ success: true, message: 'Message reçu (SMTP non configuré)' });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        const emailTo = process.env.EMAIL_TO || process.env.EMAIL_USER;

        // Email vers l'administrateur
        await transporter.sendMail({
            from: '"AuditAxis QSE" <' + process.env.EMAIL_USER + '>',
            replyTo: email,
            to: emailTo,
            subject: '[AuditAxis] ' + sujet,
            html: `<h2>Nouveau message de contact</h2><p><b>Nom:</b> ${nom}</p><p><b>Email:</b> ${email}</p>${company ? `<p><b>Entreprise:</b> ${company}</p>` : ''}<p><b>Message:</b><br>${message.replace(/\n/g, '<br>')}</p>`,
        });

        // Email de confirmation pour l'expéditeur
        await transporter.sendMail({
            from: '"AuditAxis QSE" <' + process.env.EMAIL_USER + '>',
            to: email,
            subject: 'Message reçu — AuditAxis QSE',
            html: `<h2>Merci, ${nom} !</h2><p>Nous avons bien reçu votre message.</p><p><b>Sujet :</b> ${sujet}</p>`,
        });

        console.log('✅ Emails envoyés');
        res.json({ success: true, message: 'Message envoyé avec succès' });
    } catch (error) {
        console.error('❌ Erreur email:', error.message);
        res.status(500).json({ error: 'EMAIL_SEND_FAILED', message: "Impossible d'envoyer le message." });
    }
});

// ─────────────────────────────────────────────
// SANTÉ ET ÉTAT DU SERVEUR
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

app.get('/', (req, res) => {
    res.json({
        name: 'AuditAxis QSE Backend',
        version: '1.0.0',
        endpoints: { 
            health: '/api/health', 
            diagnostic: '/api/diagnostic', 
            checklist: '/api/checklist', 
            contact: '/api/contact' 
        },
    });
});

// ─────────────────────────────────────────────
// GESTION DES ERREURS
// ─────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({ error: 'ROUTE_NON_TROUVEE', message: 'Route non trouvée', path: req.path });
});

app.use((err, req, res, next) => {
    console.error('❌ Erreur:', err);
    if (err.status === 401) return res.status(401).json({ error: 'AUTH_ERROR', message: 'Erreur auth IA' });
    if (err.status === 429) return res.status(429).json({ error: 'RATE_LIMIT', message: 'Trop de requêtes IA' });
    res.status(err.status || 500).json({ error: 'ERREUR_SERVEUR', message: 'Erreur interne' });
});

// ─────────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────────

app.listen(PORT, () => {
    console.log('🚀 Serveur démarré sur port ' + PORT);
    console.log('📧 SMTP: ' + (process.env.EMAIL_USER ? '✅' : '⚠️ non configuré'));
});

module.exports = app;
