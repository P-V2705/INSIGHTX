export function setupDiagnosticEndpoints(app, config, parseCookies) {
  // Test A: Cookie Forwarding
  app.get('/api/diagnostic/set-cookie', (req, res) => {
    const timestamp = new Date().toISOString();
    res.append(
      'Set-Cookie',
      [
        'insightx_diagnostic_cookie=test_value_' + Date.now(),
        'Path=/',
        'Max-Age=3600',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
      ].join('; '),
    );
    res.json({
      test: 'A - Set-Cookie Test',
      message: 'Cookie should be visible in browser DevTools > Application > Cookies',
      timestamp,
      expectedCookieName: 'insightx_diagnostic_cookie',
      expectedDomain: 'insight-dev.netlify.app (or current request domain)',
    });
  });

  // Test B: Redirect Handling
  app.get('/api/diagnostic/redirect', (req, res) => {
    const testTarget = `${config.appOrigin}/api/diagnostic/redirect-target`;
    res.setHeader('Cache-Control', 'no-store');
    console.log(`[diagnostic] Redirect test: ${testTarget}`);
    res.redirect(302, testTarget);
  });

  app.get('/api/diagnostic/redirect-target', (req, res) => {
    res.json({
      test: 'B - Redirect Test',
      message: 'If you see this, the redirect was successful',
      timestamp: new Date().toISOString(),
      receivedAt: 'Railway backend',
    });
  });

  // Test C: Cookie Round Trip
  app.get('/api/diagnostic/read-cookie', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const diagnosticCookie = cookies.insightx_diagnostic_cookie || '(not found)';
    const allCookieNames = Object.keys(cookies);

    res.json({
      test: 'C - Cookie Round Trip Test',
      message: 'Diagnostic cookie from browser should be visible here',
      timestamp: new Date().toISOString(),
      diagnosticCookieReceived: diagnosticCookie,
      allReceivedCookies: allCookieNames,
      userAgent: req.headers['user-agent'] || '(not provided)',
      originHeader: req.headers.origin || '(not provided)',
    });
  });

  // Test D: Request Headers Through Proxy
  app.get('/api/diagnostic/headers', (req, res) => {
    res.json({
      test: 'D - Request Headers Inspection',
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      headers: {
        origin: req.headers.origin || '(not provided)',
        referer: req.headers.referer || '(not provided)',
        cookie: req.headers.cookie ? `(${Object.keys(parseCookies(req.headers.cookie)).length} cookies)` : '(none)',
        userAgent: (req.headers['user-agent'] || '(not provided)').slice(0, 100),
        xForwardedFor: req.headers['x-forwarded-for'] || '(not provided)',
        xForwardedProto: req.headers['x-forwarded-proto'] || '(not provided)',
        xForwardedHost: req.headers['x-forwarded-host'] || '(not provided)',
      },
    });
  });

  console.log('[diagnostic] Diagnostic endpoints mounted at /api/diagnostic/*');
}
