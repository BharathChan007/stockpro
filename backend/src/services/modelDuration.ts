import { prisma } from "../lib/prisma.js";

export async function getHardBlockDaysForModel(modelName: string): Promise<number> {
  const globalRow = await prisma.globalConfig.findUnique({ where: { id: 1 } });
  const fallback = globalRow?.defaultBlockingDays ?? 7;
  const cfg = await prisma.modelConfig.findUnique({
    where: { modelName },
  });
  return cfg?.blockingDurationDays ?? fallback;
}
