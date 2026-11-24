// server/prisma.js
// Reusable Prisma Client module for database access

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

let prisma = globalForPrisma.prisma;
if (!prisma) {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
