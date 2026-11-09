# Security Policy

## Supported Versions

We release security updates for the latest stable version of UnifiedCron. If you are using an older version, we recommend upgrading.

| Version | Supported |
|---------|-----------|
| Latest  | ✅ Yes    |
| < Latest | ❌ No     |

## Reporting a Vulnerability

**Do NOT report security vulnerabilities through public GitHub issues.**

Instead, please use one of these secure channels:

1. **GitHub Security Advisory** (preferred):
   - Go to https://github.com/rohitdoddapani/unifiedcron/security/advisories
   - Click "Report a vulnerability"
   - Provide a detailed description and steps to reproduce

2. **Encrypted Email** (PGP encrypted):
   - Send to: security@unifiedcron.com
   - Include your PGP public key
   - Encrypt your message with our PGP key (see below)

3. **Private Issue** (if you have access):
   - Create a private issue in the repository

## Preferred Languages

We accept vulnerability reports in:
- English
- Any language our maintainers speak fluently

## Response Time

- **Critical severity**: Within 24 hours
- **High severity**: Within 72 hours  
- **Medium/Low severity**: Within 1 week

## What We Promise

- We will acknowledge receipt of your report within 2 business days
- We will provide regular updates on our progress
- We will notify you when the vulnerability is fixed
- We will credit you in release notes (unless you prefer to remain anonymous)

## What to Include in Your Report

- Type of vulnerability (e.g., SQL injection, XSS, RCE)
- Step-by-step instructions to reproduce
- Impact of the vulnerability
- Any proof-of-concept code
- Your assessment of severity
- Your preferred disclosure timeline

## Out of Scope

The following are considered out of scope for security reports:
- Issues in third-party dependencies (report to the upstream project)
- Theoretical vulnerabilities without proof-of-concept
- Denial of service attacks against your own instance
- Missing security headers (unless they lead to a concrete vulnerability)
- Issues that require physical access to the server

## Threat Model

### What UnifiedCron Stores

- User credentials (encrypted at rest)
- Connection configuration (encrypted at rest)
- Job schedules and metadata
- Run history and outcomes
- Alert configurations and webhook endpoints

### What UnifiedCron Can Access

**Supabase signed-push path:**
- UnifiedCron holds **no** database credentials
- A compromised instance leaks:
  - Job names and schedules
  - Run outcomes and metadata
  - User account information (email addresses)
- **Blast radius**: Limited to job discovery and monitoring data

**Supabase direct-reader path:**
- Requires a dedicated PostgreSQL reader role
- Access is scoped to private metadata views only
- Cannot modify application data or credentials
- **Blast radius**: Limited to read-only monitoring data

**n8n (planned, M2):**
- n8n API keys on non-Enterprise instances grant **full access** to everything the user can do
- There are **no scopes** outside Enterprise (https://docs.n8n.io/connect/n8n-api/authentication)
- **Blast radius**: **Full account compromise**
- Mitigation for non-Enterprise: Use a dedicated low-privilege n8n user with read-only workflows enforced in UnifiedCron code
- For Enterprise: Use scoped API keys with limited permissions

### Attack Vectors

1. **Unauthenticated API access** - Protected by JWT authentication
2. **Database injection** - Protected by parameterized queries and ORM
3. **Secret exposure** - Credentials encrypted at rest, masked in logs
4. **CSRF** - Protected by CSRF tokens in web app
5. **XSS** - Protected by CSP and React's built-in protections
6. **SSRF** - Protected by allowlist validation of webhook URLs
7. **Credential stuffing** - Protected by rate limiting and account lockout

### Data Flow

```
User → Dashboard (Next.js) → API (Express) → Database (PostgreSQL)
                                      ↓
                                Worker (Node) → Supabase API
```

### Encryption

- **At rest**: All secrets encrypted with AES-256-GCM using a 32-byte base64 key
- **In transit**: All external communications use HTTPS/TLS
- **Key management**: ENCRYPTION_KEY environment variable (32 bytes base64)

### Authentication

- **Web**: NextAuth.js with JWT sessions
- **API**: JWT tokens signed with JWT_SECRET
- **Database**: Per-connection credentials with least privilege

## Security Best Practices for Self-Hosting

### Network Isolation

- Run UnifiedCron in an isolated network segment
- Use a reverse proxy with TLS termination
- Restrict database access to UnifiedCron worker IP
- Enable firewall rules to limit exposure

### Credential Management

- Use strong, unique passwords for all accounts
- Rotate ENCRYPTION_KEY periodically
- Store secrets in environment variables, not files
- Use secret management tools in production

### Monitoring

- Enable database audit logging
- Monitor API access logs for suspicious activity
- Set up alerts for failed authentication attempts
- Regularly review user access permissions

### Updates

- Keep all dependencies updated
- Monitor security advisories for dependencies
- Test updates in staging before production
- Have a rollback plan for critical updates

## Security Features

### Input Validation

- All API inputs validated with Zod schemas
- SQL queries use parameterized queries
- Webhook URLs validated for HTTPS and allowlist
- File uploads (if any) scanned for malware

### Output Encoding

- API responses sanitized to prevent XSS
- Error messages do not leak sensitive data
- Stack traces disabled in production
- CSP headers set to restrict inline scripts

### Rate Limiting

- API endpoints rate limited
- Authentication attempts rate limited
- Webhook delivery retries with exponential backoff
- Alert notifications deduplicated

## Reporting Security Issues

If you believe you've found a security vulnerability, please report it responsibly. We will work with you to verify and fix the issue promptly.

**Do not:**
- Exploit the vulnerability beyond what's necessary to demonstrate it
- Share the vulnerability publicly before we've had a chance to fix it
- Use the vulnerability to access or modify data you don't own

**Do:**
- Provide detailed reproduction steps
- Keep communication confidential
- Allow us reasonable time to fix before public disclosure

## PGP Key

Our PGP public key is available upon request. Please contact security@unifiedcron.com to obtain it.

---

*This security policy is based on the OpenSSF Scorecard recommendations and follows industry best practices.*
