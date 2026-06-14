import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorCode, RoleName } from "@renting/shared";
import * as bcrypt from "bcryptjs";
import { AppException } from "../../common/app.exception";
import { CryptoService } from "../../common/crypto.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async byUserId(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw AppException.notFound("Driver profile not found");
    return driver;
  }

  async availableBetween(start: Date, end: Date) {
    if (isNaN(+start) || isNaN(+end) || end <= start) {
      throw new AppException(ErrorCode.ValidationError, "Invalid start/end", HttpStatus.BAD_REQUEST);
    }
    const drivers = await this.prisma.driver.findMany({
      where: {
        status: "active",
        timeOff: { none: { startAt: { lt: end }, endAt: { gt: start } } },
        bookings: { none: { status: { in: ["pending", "confirmed", "ongoing"] }, startAt: { lt: end }, endAt: { gt: start } } },
      },
      select: {
        id: true, bio: true, photoUrl: true, languages: true, yearsExperience: true,
        hourlyRate: true, dailyRate: true, avgRating: true, ratingsCount: true,
        user: { select: { firstName: true } },
      },
      orderBy: { avgRating: "desc" },
    });
    return drivers;
  }

  async create(dto: {
    userId?: string; email?: string; firstName?: string; lastName?: string;
    bio?: Record<string, string>; photoUrl?: string; languages?: string[];
    yearsExperience?: number; hourlyRate?: number; dailyRate?: number; commissionPercent?: number;
  }) {
    let userId = dto.userId;
    const driverRole = await this.prisma.role.findUniqueOrThrow({ where: { name: RoleName.Driver } });

    if (!userId) {
      if (!dto.email || !dto.firstName) {
        throw new AppException(ErrorCode.ValidationError, "Provide userId, or email + firstName to create the account");
      }
      const tempPassword = this.crypto.randomToken(8);
      const user = await this.prisma.user.create({
        data: {
          email: dto.email, firstName: dto.firstName, lastName: dto.lastName ?? "",
          passwordHash: await bcrypt.hash(tempPassword, 10),
          roles: { create: { roleId: driverRole.id } },
        },
      });
      userId = user.id;
    } else {
      const existing = await this.prisma.userRole.findUnique({
        where: { userId_roleId: { userId, roleId: driverRole.id } },
      });
      if (!existing) await this.prisma.userRole.create({ data: { userId, roleId: driverRole.id } });
    }

    const duplicate = await this.prisma.driver.findUnique({ where: { userId } });
    if (duplicate) {
      throw new AppException(ErrorCode.Conflict, "User already has a driver profile", HttpStatus.CONFLICT);
    }

    return this.prisma.driver.create({
      data: {
        userId,
        bio: dto.bio, photoUrl: dto.photoUrl, languages: dto.languages ?? [],
        yearsExperience: dto.yearsExperience ?? 0,
        hourlyRate: dto.hourlyRate ?? 0, dailyRate: dto.dailyRate ?? 0,
        commissionPercent: dto.commissionPercent ?? 0,
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }

  async replaceSchedule(driverId: string, slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) {
    await this.prisma.$transaction([
      this.prisma.driverSchedule.deleteMany({ where: { driverId } }),
      this.prisma.driverSchedule.createMany({ data: slots.map((s) => ({ driverId, ...s })) }),
    ]);
    return this.prisma.driverSchedule.findMany({ where: { driverId }, orderBy: { dayOfWeek: "asc" } });
  }
}
