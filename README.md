# Meri Dukaan Backend

NestJS backend for Meri Dukaan POS system.

## Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

## Build

```bash
npm run build
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT secret key
- `CORS_ORIGIN` - CORS allowed origins
