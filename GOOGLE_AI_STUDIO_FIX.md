# Google AI Studio Security Cookie Fix

This document explains the technical details of the security cookie fix for Google AI Studio.

## The Problem
When deploying an application to Google AI Studio, it runs in a cross-origin iframe. This can cause issues with:
1. **CORS**: Requests from the app to the server are blocked.
2. **Cookies**: Authentication cookies are blocked by the browser's security policies.

The error message typically looks like:
"Almost there! Grant permission for the required security cookie below."

## The Solution

### 1. CORS Configuration
The server must explicitly allow the application's origin and support credentials (cookies).

```typescript
const corsOptions = {
  origin: [APP_URL, 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));
```

### 2. Security Headers
Using `helmet` helps set proper security headers. However, some policies like `Content-Security-Policy` (CSP) and `Cross-Origin-Embedder-Policy` (COEP) might need to be relaxed for local development or Vite compatibility.

```typescript
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
```

### 3. Cookie Attributes
For cookies to work in a cross-origin iframe, they must have specific attributes:
- `httpOnly`: True (security best practice).
- `secure`: True (required for `sameSite: 'none'`).
- `sameSite`: 'none' (required for cross-origin iframes).

```typescript
res.cookie('auth_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'none',
  maxAge: 3600000 // 1 hour
});
```

### 4. Config Endpoint
The `/api/config` endpoint allows the application to verify its environment and API availability at runtime.

```typescript
app.get('/api/config', (req, res) => {
  res.json({
    appUrl: APP_URL,
    geminiAvailable: !!process.env.GEMINI_API_KEY,
    environment: process.env.NODE_ENV || 'development',
  });
});
```

## Conclusion
By implementing these changes, the application can securely handle authentication and API requests within the Google AI Studio environment.
