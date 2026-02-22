import { startOfDay, endOfDay, subDays, subYears } from "date-fns";
import { Prisma } from "../generated/prisma/client";

export type DateRange = "7d" | "30d" | "90d" | "1y" | "all" ;

export function dateFilterHelper(
  range?: DateRange,
  from?: string,
  to?: string
): Prisma.DateTimeFilter | undefined {
  const now = new Date();

  if (from) {
    const fromDate = new Date(from);
    const endDate = to ? new Date(to) : now;

    return {
      gte: startOfDay(fromDate),
      lte: endOfDay(endDate),
    };
  }

  if (range && range !== "all") {
    let fromDate: Date;

    switch (range) {
      case "7d":
        fromDate = subDays(now, 6);
        break;
      case "30d":
        fromDate = subDays(now, 29);
        break;
      case "90d":
        fromDate = subDays(now, 89);
        break;
      case "1y":
        fromDate = subYears(now, 1);
        break;
      default:
        return undefined
    }

    return {
      gte: startOfDay(fromDate),
      lte: endOfDay(now),
    };
  }

  return undefined
}
