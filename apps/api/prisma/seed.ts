import { PrismaClient, PricingUnit } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const t = (en: string, ru: string, ar: string) => ({ en, ru, ar });

async function main() {
  // ── RBAC ────────────────────────────────────────────────
  const permissionKeys = [
    "categories.manage", "listings.manage", "bookings.manage", "drivers.manage",
    "customers.manage", "coupons.manage", "reviews.moderate", "content.manage",
    "settings.manage", "reports.view", "webhooks.manage", "api-keys.manage",
  ];
  await prisma.permission.createMany({
    data: permissionKeys.map((key) => ({ key })),
    skipDuplicates: true,
  });
  const allPerms = await prisma.permission.findMany();

  const roles: Record<string, string[]> = {
    customer: [],
    driver: [],
    staff: ["listings.manage", "bookings.manage", "drivers.manage", "customers.manage", "reviews.moderate", "reports.view"],
    super_admin: permissionKeys,
  };
  for (const [name, perms] of Object.entries(roles)) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    for (const key of perms) {
      const perm = allPerms.find((p) => p.key === key)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // ── Users ───────────────────────────────────────────────
  const password = await bcrypt.hash("Password1!", 10);
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: "super_admin" } });
  const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
  const driverRole = await prisma.role.findUniqueOrThrow({ where: { name: "driver" } });

  const admin = await prisma.user.upsert({
    where: { email: "admin@renting.ru" },
    update: {},
    create: {
      email: "admin@renting.ru", phone: "+10000000001", passwordHash: password,
      firstName: "Super", lastName: "Admin", emailVerifiedAt: new Date(),
      roles: { create: { roleId: superAdminRole.id } },
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com", phone: "+10000000002", passwordHash: password,
      firstName: "Dana", lastName: "Customer", emailVerifiedAt: new Date(),
      roles: { create: { roleId: customerRole.id } },
    },
  });

  // ── Locations ───────────────────────────────────────────
  const locationsData = [
    { name: t("Downtown branch", "Центральный офис", "الفرع الرئيسي"), type: "branch" as const, city: "Moscow", countryCode: "RU", lat: 55.7558, lng: 37.6173 },
    { name: t("Airport SVO", "Аэропорт Шереметьево", "مطار شيريميتيفو"), type: "airport" as const, city: "Moscow", countryCode: "RU", lat: 55.9726, lng: 37.4146 },
    { name: t("City West zone", "Западный район", "المنطقة الغربية"), type: "city_zone" as const, city: "Moscow", countryCode: "RU", lat: 55.7287, lng: 37.4435 },
  ];
  const locations: Array<{ id: string }> = [];
  for (const loc of locationsData) {
    const existing = await prisma.location.findFirst({ where: { city: loc.city, type: loc.type } });
    locations.push(existing ?? (await prisma.location.create({ data: loc })));
  }

  // ── Cars category: the proof of the engine ──────────────
  const cars = await prisma.rentalCategory.upsert({
    where: { slug: "cars" },
    update: {},
    create: {
      slug: "cars",
      name: t("Cars", "Автомобили", "سيارات"),
      description: t("Rent a car with or without a driver", "Аренда авто с водителем и без", "استأجر سيارة مع سائق أو بدونه"),
      icon: "car",
      sortOrder: 1,
      isEnabled: true,
      config: {
        requiresDriverOption: true,
        requiresLicenseVerification: true,
        usesCheckInOut: false,
        securityDeposit: { required: true, type: "fixed", value: 200 },
        minDurationMinutes: 60,
        maxDurationMinutes: 60 * 24 * 90,
        leadTimeMinutes: 60,
        freeCancellationMinutes: 60 * 24,
      },
    },
  });

  const carAttrs = [
    { key: "brand", label: t("Brand", "Марка", "الماركة"), dataType: "select", isRequired: true, isFilterable: true, filterWidget: "select", showInCard: true, sortOrder: 1,
      options: ["toyota", "bmw", "mercedes", "hyundai", "kia", "lada"].map((v) => ({ value: v, label: t(v[0].toUpperCase() + v.slice(1), v[0].toUpperCase() + v.slice(1), v) })) },
    { key: "model", label: t("Model", "Модель", "الموديل"), dataType: "text", isRequired: true, isFilterable: false, showInCard: true, sortOrder: 2 },
    { key: "year", label: t("Year", "Год", "السنة"), dataType: "number", isRequired: true, isFilterable: true, filterWidget: "range", showInCard: true, sortOrder: 3, validation: { min: 2000, max: 2027 } },
    { key: "body_type", label: t("Body type", "Кузов", "نوع الهيكل"), dataType: "select", isRequired: true, isFilterable: true, filterWidget: "select", showInCard: false, sortOrder: 4,
      options: [
        { value: "sedan", label: t("Sedan", "Седан", "سيدان") },
        { value: "suv", label: t("SUV", "Внедорожник", "دفع رباعي") },
        { value: "hatchback", label: t("Hatchback", "Хэтчбек", "هاتشباك") },
        { value: "minivan", label: t("Minivan", "Минивэн", "ميني فان") },
        { value: "luxury", label: t("Luxury", "Люкс", "فاخرة") },
      ] },
    { key: "transmission", label: t("Transmission", "Коробка", "ناقل الحركة"), dataType: "select", isRequired: true, isFilterable: true, filterWidget: "select", showInCard: true, sortOrder: 5,
      options: [
        { value: "automatic", label: t("Automatic", "Автомат", "أوتوماتيك") },
        { value: "manual", label: t("Manual", "Механика", "يدوي") },
      ] },
    { key: "fuel", label: t("Fuel", "Топливо", "الوقود"), dataType: "select", isRequired: true, isFilterable: true, filterWidget: "select", showInCard: false, sortOrder: 6,
      options: [
        { value: "petrol", label: t("Petrol", "Бензин", "بنزين") },
        { value: "diesel", label: t("Diesel", "Дизель", "ديزل") },
        { value: "hybrid", label: t("Hybrid", "Гибрид", "هجين") },
        { value: "electric", label: t("Electric", "Электро", "كهربائية") },
      ] },
    { key: "seats", label: t("Seats", "Мест", "المقاعد"), dataType: "number", unit: "seats", isRequired: true, isFilterable: true, filterWidget: "range", showInCard: true, sortOrder: 7, validation: { min: 2, max: 9 } },
    { key: "doors", label: t("Doors", "Дверей", "الأبواب"), dataType: "number", isRequired: false, isFilterable: false, sortOrder: 8 },
    { key: "air_conditioning", label: t("Air conditioning", "Кондиционер", "تكييف"), dataType: "boolean", isRequired: false, isFilterable: true, filterWidget: "toggle", sortOrder: 9 },
    { key: "color", label: t("Color", "Цвет", "اللون"), dataType: "text", isRequired: false, isFilterable: false, sortOrder: 10 },
  ];
  for (const attr of carAttrs) {
    await prisma.categoryAttribute.upsert({
      where: { categoryId_key: { categoryId: cars.id, key: attr.key } },
      update: {},
      create: { categoryId: cars.id, ...(attr as any) },
    });
  }

  for (const [unit, def] of [
    [PricingUnit.hour, { isDefault: false, minQuantity: 3, maxQuantity: 24 }],
    [PricingUnit.day, { isDefault: true, minQuantity: 1, maxQuantity: 90 }],
    [PricingUnit.week, { isDefault: false, minQuantity: 1, maxQuantity: 12 }],
  ] as const) {
    await prisma.categoryPricingUnit.upsert({
      where: { categoryId_unit: { categoryId: cars.id, unit } },
      update: {},
      create: { categoryId: cars.id, unit, ...def },
    });
  }

  // ── Extras (cars) ───────────────────────────────────────
  const extrasData = [
    { name: t("Child seat", "Детское кресло", "مقعد أطفال"), price: 5, priceType: "per_unit" as const },
    { name: t("GPS navigator", "GPS-навигатор", "نظام ملاحة"), price: 3, priceType: "per_unit" as const },
    { name: t("Full insurance", "Полная страховка", "تأمين شامل"), price: 25, priceType: "per_booking" as const },
  ];
  const existingExtras = await prisma.extra.count({ where: { categoryId: cars.id } });
  if (existingExtras === 0) {
    await prisma.extra.createMany({ data: extrasData.map((e) => ({ ...e, categoryId: cars.id })) });
  }

  // ── Drivers ─────────────────────────────────────────────
  const driverUsers = [
    { email: "driver.sergey@renting.ru", firstName: "Sergey", lastName: "Ivanov", languages: ["ru", "en"], yearsExperience: 12, hourlyRate: 12, dailyRate: 80 },
    { email: "driver.amina@renting.ru", firstName: "Amina", lastName: "Hassan", languages: ["ar", "en", "ru"], yearsExperience: 7, hourlyRate: 14, dailyRate: 90 },
  ];
  for (const [i, d] of driverUsers.entries()) {
    const u = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email, phone: `+1000000010${i}`, passwordHash: password,
        firstName: d.firstName, lastName: d.lastName, emailVerifiedAt: new Date(),
        roles: { create: { roleId: driverRole.id } },
      },
    });
    await prisma.driver.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        bio: t(`Professional chauffeur, ${d.yearsExperience} years on the road.`, `Профессиональный водитель, стаж ${d.yearsExperience} лет.`, `سائق محترف بخبرة ${d.yearsExperience} سنة.`),
        languages: d.languages, yearsExperience: d.yearsExperience,
        hourlyRate: d.hourlyRate, dailyRate: d.dailyRate, commissionPercent: 20,
        schedules: { create: [1, 2, 3, 4, 5, 6].map((dow) => ({ dayOfWeek: dow, startTime: "08:00", endTime: "22:00" })) },
      },
    });
  }

  // ── Fleet ───────────────────────────────────────────────
  const fleet = [
    { slug: "toyota-camry-2023", title: t("Toyota Camry 2023", "Toyota Camry 2023", "تويوتا كامري 2023"),
      attributes: { brand: "toyota", model: "Camry", year: 2023, body_type: "sedan", transmission: "automatic", fuel: "petrol", seats: 5, doors: 4, air_conditioning: true, color: "white" },
      prices: { hour: 9, day: 55, week: 330 }, featured: true },
    { slug: "bmw-x5-2024", title: t("BMW X5 2024", "BMW X5 2024", "بي إم دبليو X5 2024"),
      attributes: { brand: "bmw", model: "X5", year: 2024, body_type: "suv", transmission: "automatic", fuel: "hybrid", seats: 5, doors: 5, air_conditioning: true, color: "black" },
      prices: { hour: 18, day: 120, week: 720 }, featured: true },
    { slug: "mercedes-e-class-2023", title: t("Mercedes E-Class 2023", "Mercedes E-Class 2023", "مرسيدس الفئة E 2023"),
      attributes: { brand: "mercedes", model: "E 200", year: 2023, body_type: "luxury", transmission: "automatic", fuel: "petrol", seats: 5, doors: 4, air_conditioning: true, color: "silver" },
      prices: { hour: 16, day: 110, week: 660 }, featured: true },
    { slug: "hyundai-solaris-2022", title: t("Hyundai Solaris 2022", "Hyundai Solaris 2022", "هيونداي سولاريس 2022"),
      attributes: { brand: "hyundai", model: "Solaris", year: 2022, body_type: "sedan", transmission: "automatic", fuel: "petrol", seats: 5, doors: 4, air_conditioning: true, color: "blue" },
      prices: { hour: 6, day: 35, week: 210 }, featured: false },
    { slug: "kia-carnival-2023", title: t("Kia Carnival 2023", "Kia Carnival 2023", "كيا كرنفال 2023"),
      attributes: { brand: "kia", model: "Carnival", year: 2023, body_type: "minivan", transmission: "automatic", fuel: "diesel", seats: 7, doors: 5, air_conditioning: true, color: "gray" },
      prices: { hour: 11, day: 70, week: 420 }, featured: false },
    { slug: "lada-vesta-2022", title: t("Lada Vesta 2022", "Lada Vesta 2022", "لادا فيستا 2022"),
      attributes: { brand: "lada", model: "Vesta", year: 2022, body_type: "sedan", transmission: "manual", fuel: "petrol", seats: 5, doors: 4, air_conditioning: false, color: "red" },
      prices: { hour: 4, day: 25, week: 150 }, featured: false },
  ];

  for (const [i, car] of fleet.entries()) {
    await prisma.listing.upsert({
      where: { slug: car.slug },
      update: {},
      create: {
        categoryId: cars.id,
        slug: car.slug,
        title: car.title,
        description: t(
          `Well-maintained ${(car.title as any).en} available for self-drive or with a professional chauffeur.`,
          `Ухоженный ${(car.title as any).ru} — аренда с водителем или без.`,
          `${(car.title as any).ar} بحالة ممتازة، متاحة للقيادة الذاتية أو مع سائق.`,
        ),
        status: "active",
        locationId: locations[i % locations.length].id,
        attributes: car.attributes,
        isFeatured: car.featured,
        media: {
          create: [0, 1, 2].map((n) => ({
            url: `https://picsum.photos/seed/${car.slug}-${n}/1200/800`,
            sortOrder: n,
            isCover: n === 0,
          })),
        },
        prices: {
          create: Object.entries(car.prices).map(([unit, price]) => ({
            pricingUnit: unit as PricingUnit, currency: "USD", basePrice: price,
          })),
        },
      },
    });
  }

  // Seasonal pricing example: +20% across Cars in July–August.
  const existingRule = await prisma.priceRule.findFirst({ where: { name: "Summer peak" } });
  if (!existingRule) {
    await prisma.priceRule.create({
      data: {
        scope: "category", categoryId: cars.id, name: "Summer peak",
        startsOn: new Date("2026-07-01"), endsOn: new Date("2026-08-31"),
        adjustmentType: "percent", adjustmentValue: 20, priority: 10,
      },
    });
  }

  // ── Coupon ──────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10", type: "percent", value: 10, minAmount: 50, maxDiscount: 50,
      usageLimit: 1000, perUserLimit: 1,
      validFrom: new Date("2026-01-01"), validTo: new Date("2026-12-31"),
    },
  });

  // ── Settings ────────────────────────────────────────────
  const settings: Array<{ key: string; value: any; group: string; isPublic: boolean }> = [
    { key: "currencies", value: { default: "USD", supported: ["USD", "EUR", "RUB", "AED"], rates: { USD: 1, EUR: 0.92, RUB: 88, AED: 3.67 } }, group: "money", isPublic: true },
    { key: "tax", value: { percent: 5, label: "VAT" }, group: "money", isPublic: true },
    { key: "branding", value: { siteName: "Renting.ru", supportEmail: "support@renting.ru", supportPhone: "+1 000 000 0000" }, group: "general", isPublic: true },
    { key: "booking", value: { autoConfirm: false }, group: "operations", isPublic: false },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }

  // ── Content ─────────────────────────────────────────────
  await prisma.contentPage.upsert({
    where: { slug: "terms" },
    update: {},
    create: { slug: "terms", title: t("Terms & Conditions", "Условия использования", "الشروط والأحكام"), body: t("## Terms\nDemo terms content.", "## Условия\nДемо-контент.", "## الشروط\nمحتوى تجريبي."), status: "published" },
  });
  await prisma.faq.createMany({
    data: [
      { question: t("Do I need a deposit?", "Нужен ли депозит?", "هل أحتاج إلى وديعة؟"), answer: t("Yes, a refundable security deposit is held for car rentals.", "Да, для аренды авто блокируется возвращаемый депозит.", "نعم، يتم حجز وديعة قابلة للاسترداد."), group: "payments", sortOrder: 1 },
      { question: t("Can I rent with a driver?", "Можно ли арендовать с водителем?", "هل يمكنني الاستئجار مع سائق؟"), answer: t("Yes — choose 'with driver' during booking and pick a chauffeur.", "Да — выберите опцию «с водителем» при бронировании.", "نعم — اختر 'مع سائق' أثناء الحجز."), group: "booking", sortOrder: 2 },
    ],
    skipDuplicates: true,
  });

  // Invoice number counter
  await prisma.counter.upsert({ where: { key: "invoice" }, update: {}, create: { key: "invoice", value: 1000 } });
  await prisma.counter.upsert({ where: { key: "booking" }, update: {}, create: { key: "booking", value: 1000 } });

  console.log("Seed complete.");
  console.log("  super admin : admin@renting.ru / Password1!");
  console.log("  customer    : customer@example.com / Password1!");
  console.log(`  admin id    : ${admin.id}`);
  console.log(`  customer id : ${customer.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
