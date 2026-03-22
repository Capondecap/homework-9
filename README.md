<<<<<<< HEAD
# homework-9
=======
# Express Middleware Assignment

This project secures an Energy API with layered Express.js middleware and two authentication modes:

- IP filtering for localhost only
- CORS restricted to a local development origin
- Rate limiting of 10 requests per minute
- JWT Bearer token protection for the API endpoint
- Basic Auth protection for the dashboard
- Handlebars templates with a shared stylesheet for cleaner view reuse

## Requirements

- Node.js 18 or newer
- npm

## Install and Run

```bash
npm install
npm start
```

The server starts on `http://localhost:3000` by default.

If you're on Windows PowerShell and the `npm` shim does not respond correctly, use:

```bash
npm.cmd install
npm.cmd start
```

## Local Environment File

You do not strictly need a `.env` file, because the app has safe defaults, but it is a good idea for cleaner configuration.

Create your local file from the example:

```bash
copy .env.example .env
```

Then update the values in `.env` if you want custom credentials, port, origin, or JWT secret.

## Test Credentials

The same credentials are used for both:

- generating a JWT from `POST /auth/token`
- signing in to `GET /dashboard` with Basic Auth

Credentials:

- Username: `energy-admin`
- Password: `CrudeOil2026!`

These values are exact and case-sensitive. The username includes the hyphen.

## Bearer Token for Testing

The API no longer uses a hard-coded token. Instead, generate a JWT first:

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"energy-admin\",\"password\":\"CrudeOil2026!\"}"
```

The response returns an `access_token`. Use that JWT as your Bearer token when calling the API.

## Environment Variables

You can override the defaults with:

- `PORT`
- `ALLOWED_ORIGIN`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `JWT_SECRET`

An example file is included at `.env.example`.

## Endpoints

### `POST /auth/token`

Accepts a JSON body with `username` and `password`, then returns a JWT token for API access.

Example:

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"energy-admin\",\"password\":\"CrudeOil2026!\"}"
```

### `GET /api/oil-prices`

Protected with JWT Bearer authentication.

Example:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3000/api/oil-prices
```

### `GET /dashboard`

Protected with HTTP Basic Auth and serves the Handlebars dashboard UI.

Example:

```bash
curl -u energy-admin:CrudeOil2026! http://localhost:3000/dashboard
```

### `GET /logout`

Redirects to a logged-out page and sends headers that help clear cached Basic Auth credentials.

## View Structure

- `views/layouts/main.handlebars`: shared page shell
- `views/home.handlebars`: landing page
- `views/dashboard.handlebars`: protected dashboard
- `views/logged-out.handlebars`: logout message
- `public/styles/style.css`: shared styling

## Middleware Order

The application applies middleware in this order:

1. Custom IP filter
2. `cors`
3. `express-rate-limit`
4. Body parsers and static assets
5. Route-level authentication middleware

## Notes

- Only requests from `127.0.0.1` or `::1` are allowed.
- The default allowed CORS origin is `http://localhost:3000`.
- The dashboard logout behavior depends on browser handling of Basic Auth credential caching.
>>>>>>> 9d15897 (homework 9)
