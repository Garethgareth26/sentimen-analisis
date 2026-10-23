/**
 * Central Error Handler Middleware sesuai standar DNIA DX Vol 1
 */
export function errorHandler(err, _req, res, _next) {
  console.error('[Error Handler]', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Terjadi kesalahan internal pada server.';

  res.status(statusCode).json({
    ok: false,
    code: err.code || 'INTERNAL_ERROR',
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}
