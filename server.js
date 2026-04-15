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
// SÉCURITÉ (RATE LIMITING)
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
    message: { error: 'RATE_LIMIT_STRICT', message: 'Limite diagnostic atteinte.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─────────────────────────────────────────────
// ROUTES API
// ─────────────────────────────────────────────

const diagnosticRouter = require('./routes/diagnostic');
const checklistRouter = require('./routes/checklist');

app.use('/api/diagnostic', diagnosticLimiter, diagnosticRouter);
app.use('/api/checklist', checklistRouter);

// ─────────────────────────────────────────────
// POST /api/contact — ENVOI D'EMAIL
// ─────────────────────────────────────────────

app.post('/api/contact', async (req, res) => {
    const { nom, email, sujet, message, company } = req.body;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validations
    if (!nom || typeof nom !== 'string' || nom.trim().length < 2) {
        return res.status(400).json({ error: 'NOM_INVALIDE', message: 'Nom requis' });
    }
    if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'EMAIL_INVALIDE', message: 'Email invalide' });
    }
    if (!sujet || sujet.trim().length < 5) {
        return res.status(400).json({ error: 'SUJET_INVALIDE', message: 'Sujet requis' });
    }
    if (!message || message.trim().length < 20) {
        return res.status(400).json({ error: 'MESSAGE_INVALIDE', message: 'Message requis' });
    }

    console.log('📧 Message de ' + nom + ' (' + email + ') — Sujet: ' + sujet);

    // Vérification SMTP
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ SMTP non configuré');
        return res.json({ success: true, message: 'Message envoyé avec succès' });
    }

    // Envoi asynchrone (non-bloquant)
    (async () => {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
            });
            const emailTo = process.env.EMAIL_TO || process.env.EMAIL_USER;

            // Notification Admin
            await transporter.sendMail({
                from: '"AuditAxis QSE" <' + process.env.EMAIL_USER + '>',
                replyTo: email,
                to: emailTo,
                subject: '[AuditAxis] ' + sujet,
                html: `<h2>Nouveau message</h2><p><b>Nom:</b> ${nom}</p><p><b>Email:</b> ${email}</p><p><b>Message:</b><br>${message.replace(/\n/g, '<br>')}</p>`,
            });

            // Confirmation Expéditeur
            await transporter.sendMail({
                from: '"AuditAxis QSE" <' + process.env.EMAIL_USER + '>',
                to: email,
                subject: 'Message reçu — AuditAxis QSE',
                html: `<h2>Merci, ${nom} !</h2><p>Nous avons bien reçu votre message.</p>`,
            });

            console.log('✅ Emails envoyés');
        } catch (e) {
            console.error('❌ Erreur email:', e.message);
        }
    })();

    res.json({ success: true, message: 'Message envoyé avec succès' });
});

// ─────────────────────────────────────────────
// ROUTES DE SANTÉ
// ─────────────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        uptime: process.uptime(), 
        version: '1.0.0' 
    });
});

app.get('/', (req, res) => {
    res.json({ name: 'AuditAxis QSE Backend', version: '1.0.0' });
});

// ─────────────────────────────────────────────
// GESTIONNAIRES D'ERREURS
// ─────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({ error: 'ROUTE_NON_TROUVEE', message: 'Route non trouvée' });
});

app.use((err, req, res, next) => {
    console.error('❌ Erreur:', err);
    if (err.status === 401) return res.status(401).json({ error: 'AUTH_ERROR' });
    if (err.status === 429) return res.status(429).json({ error: 'RATE_LIMIT' });
    res.status(err.status || 500).json({ error: 'ERREUR_SERVEUR' });
});

// ─────────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────────

app.listen(PORT, () => {
    console.log('🚀 Serveur démarré sur le port ' + PORT);
});

module.exports = app;
