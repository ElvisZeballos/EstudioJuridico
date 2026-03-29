# Estudio Juridico - Sistema de Gestión Legal

Full-stack web application for legal office management.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + React Router v6
- **Backend**: Node.js + Express + TypeScript + Prisma ORM + PostgreSQL
- **Auth**: JWT (jsonwebtoken)
- **Uploads**: Multer (profile photos → backend/uploads/)
- **Encryption**: bcrypt (passwords) + AES-256-CBC (sensitive fields via Node.js crypto)

## Features

- Dark/Light mode toggle
- JWT authentication
- 3 user roles: Admin, Abogado, Cliente
- Client management with search, create, edit, view
- Profile page with photo upload
- AES-256 encryption for sensitive DB fields (DNI, phone, address, birth date, notes)
- Glassmorphism login page
- Floating card design (shadow-xl, rounded-2xl)

## Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL running locally
- npm or yarn

### 1. Backend Setup

```bash
cd backend
npm install

# Copy env and configure your DB
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed with demo data
npm run seed

# Start dev server (port 3001)
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
npm install

# Start dev server (port 5173)
npm run dev
```

### 3. Open browser

Navigate to `http://localhost:5173`

## Demo Credentials

| Role      | Email                          | Password      |
|-----------|-------------------------------|---------------|
| Admin     | admin@estudiojuridico.com     | Admin123!     |
| Abogado   | abogado@estudiojuridico.com   | Abogado123!   |
| Cliente   | cliente@ejemplo.com            | Cliente123!   |

## Environment Variables

### Backend (.env)

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/estudio_juridico"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
ENCRYPTION_KEY="your-32-char-encryption-key-here!!"
PORT=3001
FRONTEND_URL="http://localhost:5173"
```

> ENCRYPTION_KEY must be exactly 32 characters (it is padded/truncated to 32 bytes internally).

## Project Structure

```
EsrtudioJuridico/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # DB schema
│   │   └── seed-proper.ts       # Demo seed with encryption
│   ├── src/
│   │   ├── config/
│   │   │   └── encryption.ts    # AES-256-CBC helpers
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── clientController.ts
│   │   │   └── userController.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts          # JWT verification
│   │   │   └── upload.ts        # Multer config
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── clients.ts
│   │   │   └── users.ts
│   │   └── index.ts             # Express app entry
│   ├── uploads/                 # Profile photos stored here
│   └── .env
└── frontend/
    └── src/
        ├── components/
        │   ├── ui/              # Card, Button, Input, Modal
        │   ├── Layout.tsx
        │   ├── Navbar.tsx
        │   ├── Sidebar.tsx
        │   └── ProtectedRoute.tsx
        ├── context/
        │   ├── AuthContext.tsx
        │   └── ThemeContext.tsx
        ├── pages/
        │   ├── Login.tsx
        │   ├── Dashboard.tsx
        │   ├── Profile.tsx
        │   ├── Clients.tsx
        │   ├── ClientDetail.tsx
        │   └── Users.tsx
        ├── services/
        │   └── api.ts           # Axios instance + API methods
        └── types/
            └── index.ts         # TypeScript interfaces
```

## Security Notes

- All sensitive fields (DNI, phone, address, birth date, notes) are encrypted at rest with AES-256-CBC
- Passwords are hashed with bcrypt (12 rounds)
- JWT tokens expire in 7 days
- Role-based access control on both frontend and backend
- File uploads limited to 5MB, images only (JPEG, PNG, WebP)
