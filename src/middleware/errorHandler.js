export function errorHandler(err, req, res, next) {
  console.error('Unhandled request error:', err);
  if (res.headersSent) {
    return next(err);
  }

  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }

  return res.status(500).render('error', {
    message: 'Ocorreu um erro inesperado. Tente novamente e, se persistir, contate o suporte.'
  });
}
