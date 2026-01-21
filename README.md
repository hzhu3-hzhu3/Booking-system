# Breakout Room Booking System

A web application for managing room reservations with conflict prevention and fair usage policies.

## Tech Stack

**Backend**
- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- JWT authentication

**Frontend**
- React + TypeScript + Vite
- TailwindCSS
- React Query

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cd backend
cp .env.example .env

cd ../frontend
cp .env.example .env
```

3. Initialize database:
```bash
cd backend
npm run prisma:migrate
npm run seed
```

## Development

```bash
npm run dev:backend

npm run dev:frontend
```

## Testing

```bash
npm run test:backend
npm run test:frontend
```

