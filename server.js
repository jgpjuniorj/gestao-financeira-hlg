
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import session from 'express-session';
import expressEjsLayouts from 'express-ejs-layouts';
import indexRoutes from './src/routes/index.js';
import apiRoutes from './src/routes/api.js';
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/users.js';
import householdRoutes from './src/routes/households.js';
import { ensureAuth, attachLocals, requireAdmin } from './src/middleware/auth.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { initializeDatabase } from './src/services/db.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';
const SESSION_COOKIE_SECURE = (() => {
  const value = (process.env.SESSION_COOKIE_SECURE || '').toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return 'auto';
})();

if (SESSION_SECRET === 'change-me') {
  console.warn('SESSION_SECRET não definido. Use um valor forte em produção.');
}

if (SESSION_COOKIE_SECURE === 'auto') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src', 'views'));
app.use(expressEjsLayouts);
app.set('layout', 'layout');
app.use(express.static(path.join(process.cwd(), 'src', 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: 'gf.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: SESSION_COOKIE_SECURE,
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

app.use(attachLocals);

app.use('/', authRoutes);
app.use('/', ensureAuth, indexRoutes);
app.use('/users', ensureAuth, requireAdmin, userRoutes);
app.use('/admin/households', ensureAuth, requireAdmin, householdRoutes);
app.use('/api', ensureAuth, apiRoutes);

app.use((req, res) => {
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(404).json({ error: 'Recurso não encontrado.' });
  }

  return res.status(404).render('error', {
    message: 'Página não encontrada.'
  });
});

app.use(errorHandler);

async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log('Servidor rodando em http://localhost:' + PORT);
    });
  } catch (error) {
    console.error('Falha ao inicializar aplicação:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection', error);
});

start();
