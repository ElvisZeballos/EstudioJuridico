import prisma from '../../shared/prisma';

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function createPasswordResetToken(userId: string, token: string, expiresAt: Date) {
  return prisma.passwordResetToken.create({ data: { token, userId, expiresAt } });
}

export async function findPasswordResetToken(token: string) {
  return prisma.passwordResetToken.findUnique({ where: { token } });
}

export async function invalidatePendingResetTokens(userId: string) {
  return prisma.passwordResetToken.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });
}

export async function markResetTokenUsed(id: string) {
  return prisma.passwordResetToken.update({ where: { id }, data: { used: true } });
}

export async function updateUserPassword(userId: string, hashedPassword: string) {
  await prisma.client.updateMany({
    where: { userId },
    data: { active: true },
  });
  return prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword, active: true, deactivatedAt: null },
  });
}
