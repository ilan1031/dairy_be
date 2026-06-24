# Dairy Backend API

Node.js + Express + TypeScript API server for the Ganga Premium Dairy web app.

Structure follows `asset/be`.

## Development

```bash
npm install
npm run dev
```

API at: http://localhost:5096

## Build

```bash
npm run build
npm start
```

## Configuration

Copy `.env.example` to `.env` and set:

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default: 5096) |
| `ADMIN_EMAIL_MASKED` | Base64-encoded super admin email |
| `ADMIN_PASSWORD_MASKED` | Base64-encoded super admin password |
| `ADMIN_SESSION_SECRET` | Session cookie signing secret |
| `FRONTEND_URL` | Web app URL for CORS |

## API convention

All `/api/*` endpoints use **POST** only. Action is encoded in the path:

| POST path | Purpose |
|-----------|---------|
| `/api/health` | Health check |
| `/api/auth/login` | Login |
| `/api/auth/whoami` | Session check |
| `/api/auth/logout` | Logout |
| `/api/admin/users/list` | List users |
| `/api/admin/users/create` | Create user |
| `/api/admin/users/update` | Update user (`id` in body) |
| `/api/admin/users/delete` | Delete user (`id` in body) |

Root `GET /health` remains for load-balancer probes.

## Structure

```
src/
├── controllers/   # Request handlers
├── routes/        # API routes
├── middleware/    # Auth, rate limiting
├── services/      # Business logic
└── utils/         # Session helpers
```
