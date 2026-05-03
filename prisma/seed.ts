import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HALF_DISTANCE_BY_WEEK: Record<number, { wed: number; sat: number; sun: number }> = {
  1: { wed: 3.2, sat: 6.4, sun: 4.8 },
  2: { wed: 3.2, sat: 6.4, sun: 4.8 },
  3: { wed: 3.2, sat: 8.0, sun: 5.6 },
  4: { wed: 3.2, sat: 8.0, sun: 5.6 },
  5: { wed: 3.2, sat: 9.7, sun: 6.4 },
  6: { wed: 3.2, sat: 5.0, sun: 6.4 },
  7: { wed: 4.8, sat: 11.3, sun: 7.2 },
  8: { wed: 4.8, sat: 12.9, sun: 7.2 },
  9: { wed: 4.8, sat: 10.0, sun: 8.0 },
  10: { wed: 4.8, sat: 14.5, sun: 8.0 },
  11: { wed: 4.8, sat: 16.1, sun: 8.0 },
  12: { wed: 4.8, sat: 21.1, sun: 6.4 },
};

async function main() {
  await prisma.profile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Cameron",
      dateOfBirth: new Date("2002-08-16"),
      heightCm: 174,
      stravaConnected: false,
    },
  });

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      activePlan: "half",
      planStartDate: new Date("2026-05-03"),
      halfCompleted: false,
      comfortableDistKm: 5.0,
    },
  });

  const activeHalfPlans = await prisma.trainingPlan.findMany({
    where: { templateKey: "half", status: "ACTIVE" },
    select: { id: true },
  });
  for (const plan of activeHalfPlans) {
    const plannedRows = await prisma.plannedSession.findMany({ where: { planId: plan.id } });
    for (const session of plannedRows) {
      const weekly = HALF_DISTANCE_BY_WEEK[session.weekNumber];
      if (!weekly) continue;
      const expected = session.dayOfWeek === 2 ? weekly.wed : session.dayOfWeek === 5 ? weekly.sat : session.dayOfWeek === 6 ? weekly.sun : null;
      if (expected === null) continue;
      await prisma.plannedSession.update({ where: { id: session.id }, data: { distanceKm: expected } });
      await prisma.scheduledSession.updateMany({
        where: { plannedSessionId: session.id },
        data: { currentDistanceKm: expected, originalDistanceKm: expected },
      });
    }
  }

  console.log("Seed complete — Cameron's profile and settings initialised.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
