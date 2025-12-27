# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Meridian, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to: [mail@iliane.xyz](mailto:mail@iliane.xyz)
3. Include a detailed description of the vulnerability
4. Allow up to 72 hours for initial response

## Security Measures

### Authentication

- Bearer token authentication for API endpoints
- Rate limiting on authentication failures (5 attempts per minute)
- Tokens stored as environment secrets (never in code)

### Input Validation

- Zod schema validation for all API inputs
- Strict date format validation (YYYY-MM-DD)
- Email validation with disposable domain blocking
- URL sanitization before logging

### XSS Prevention

- HTML entity escaping in Open Graph generation
- Content-Security-Policy headers
- X-XSS-Protection headers

### Security Headers

All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Database Security

- Parameterized queries via Drizzle ORM
- No raw SQL string concatenation
- Connection strings stored in environment secrets

### Secrets Management

Required environment secrets:
- `MERIDIAN_SECRET_KEY` - API authentication
- `DATABASE_URL` - PostgreSQL connection
- `GOOGLE_API_KEY` - Gemini 3 API access
- `OPENAI_API_KEY` (optional) - GPT-5.2 access
- `ANTHROPIC_API_KEY` (optional) - Claude fallback
- `MISTRAL_API_KEY` (optional) - Mistral OCR
- `FIRECRAWL_API_KEY` (optional) - AI scraping

### CI/CD Security

- Dependency vulnerability scanning via `pnpm audit`
- No secrets in workflow logs
- Cloudflare Workers secrets management

## Blocked Email Domains

The following disposable email providers are blocked from newsletter subscription:
- tempmail.com, throwaway.email, 10minutemail.com
- guerrillamail.com, mailinator.com, temp-mail.org
- fakeinbox.com, trashmail.com, yopmail.com
- And others (see `subscribe.post.ts`)

## Development Guidelines

1. **Never log sensitive data** - Use `sanitizeUrlForLogging()` for URLs
2. **Always validate input** - Use Zod schemas
3. **Use neverthrow** - For type-safe error handling
4. **Escape user content** - Use `escapeHtml()` for any user input in HTML
5. **Check rate limits** - Before processing authenticated requests

## Security Audit Checklist

- [ ] All API endpoints have authentication where required
- [ ] Input validation on all user-provided data
- [ ] No hardcoded secrets in codebase
- [ ] Security headers on all responses
- [ ] Rate limiting on sensitive endpoints
- [ ] Dependency vulnerabilities addressed
- [ ] Error messages don't leak internal details
