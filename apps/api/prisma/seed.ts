import { PrismaClient, PricingUnit } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Bilingual helper — English + Arabic only
const t = (en: string, ar: string) => ({ en, ar });

// Car images: 3 shots per model [cover, interior/detail, angle]
// Using specific Unsplash photo IDs known to show automotive content
const CAR_IMAGES: Record<string, string[]> = {
  "toyota-camry-2024": [
    "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1503736334-4afe45ba28da?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1555652736-e92021d28a19?w=1200&h=800&fit=crop&q=80",
  ],
  "bmw-x5-2024": [
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1490902931801-d6f80ca94fe4?w=1200&h=800&fit=crop&q=80",
  ],
  "mercedes-e-class-2024": [
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1606664515524-ed2f786a705d?w=1200&h=800&fit=crop&q=80",
  ],
  "toyota-land-cruiser-2024": [
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200&h=800&fit=crop&q=80",
  ],
  "lexus-es-350-2023": [
    "https://images.unsplash.com/photo-1580274455191-1c62a5b5b10f?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1547744152-14d985cb937f?w=1200&h=800&fit=crop&q=80",
  ],
  "kia-carnival-2024": [
    "https://images.unsplash.com/photo-1516733725897-1aa73b87c8e8?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1609637542622-96f9d30a2bbe?w=1200&h=800&fit=crop&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=800&fit=crop&q=80",
  ],
};

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
  const customerRole   = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
  const driverRole     = await prisma.role.findUniqueOrThrow({ where: { name: "driver" } });

  const admin = await prisma.user.upsert({
    where: { email: "admin@renting.ru" },
    update: {},
    create: {
      email: "admin@renting.ru", phone: "+96600000001", passwordHash: password,
      firstName: "Super", lastName: "Admin", emailVerifiedAt: new Date(),
      roles: { create: { roleId: superAdminRole.id } },
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com", phone: "+96600000002", passwordHash: password,
      firstName: "Dana", lastName: "Al-Farsi", emailVerifiedAt: new Date(),
      roles: { create: { roleId: customerRole.id } },
    },
  });

  // Pre-approved license so demo customer can self-drive immediately
  await prisma.driverLicense.upsert({
    where: { userId: customer.id },
    update: {},
    create: {
      userId: customer.id,
      numberEncrypted: "demo-license-encrypted",
      country: "SA",
      expiresOn: new Date("2030-01-01"),
      frontImageUrl: "https://placehold.co/600x400?text=License+Front",
      status: "approved",
      reviewedAt: new Date(),
    },
  });

  // ── Locations ───────────────────────────────────────────
  const locationsData = [
    { name: t("Riyadh – Olaya Branch", "الرياض – فرع العليا"),     type: "branch"    as const, city: "Riyadh", countryCode: "SA", lat: 24.6877, lng: 46.7219 },
    { name: t("King Khalid Airport",   "مطار الملك خالد الدولي"),  type: "airport"   as const, city: "Riyadh", countryCode: "SA", lat: 24.9576, lng: 46.6988 },
    { name: t("Jeddah – Al Corniche",  "جدة – كورنيش"),            type: "city_zone" as const, city: "Jeddah", countryCode: "SA", lat: 21.5433, lng: 39.1728 },
  ];
  const locations: Array<{ id: string }> = [];
  for (const loc of locationsData) {
    const existing = await prisma.location.findFirst({ where: { city: loc.city, type: loc.type } });
    locations.push(existing ?? (await prisma.location.create({ data: loc })));
  }

  // ── Cars category ───────────────────────────────────────
  const cars = await prisma.rentalCategory.upsert({
    where: { slug: "cars" },
    update: {},
    create: {
      slug: "cars",
      name: t("Cars", "سيارات"),
      description: t("Rent a car with or without a driver", "استأجر سيارة مع سائق أو بدونه"),
      icon: "🚗",
      sortOrder: 1,
      isEnabled: true,
      config: {
        requiresDriverOption: true,
        requiresLicenseVerification: true,
        usesCheckInOut: false,
        securityDeposit: { required: true, type: "fixed", value: 500 },
        minDurationMinutes: 60,
        maxDurationMinutes: 60 * 24 * 90,
        leadTimeMinutes: 60,
        freeCancellationMinutes: 60 * 24,
      },
    },
  });

  const carAttrs = [
    { key: "brand", label: t("Brand", "الماركة"), dataType: "select", isRequired: true, isFilterable: true, filterWidget: "select", showInCard: true, sortOrder: 1,
      options: ["toyota", "bmw", "mercedes", "lexus", "nissan", "kia", "hyundai"].map((v) => ({
        value: v,
        label: t(v[0].toUpperCase() + v.slice(1), v === "bmw" ? "بي إم دبليو" : v === "mercedes" ? "مرسيدس" : v === "toyota" ? "تويوتا" : v === "lexus" ? "لكزس" : v === "nissan" ? "نيسان" : v === "kia" ? "كيا" : "هيونداي"),
      })) },
    { key: "model",        label: t("Model",        "الموديل"),        dataType: "text",   isRequired: true,  isFilterable: false, showInCard: true,  sortOrder: 2 },
    { key: "year",         label: t("Year",         "السنة"),          dataType: "number", isRequired: true,  isFilterable: true,  filterWidget: "range",  showInCard: true,  sortOrder: 3, validation: { min: 2018, max: 2027 } },
    { key: "body_type",    label: t("Body type",    "نوع الهيكل"),     dataType: "select", isRequired: true,  isFilterable: true,  filterWidget: "select", showInCard: false, sortOrder: 4,
      options: [
        { value: "sedan",   label: t("Sedan",   "سيدان") },
        { value: "suv",     label: t("SUV",     "دفع رباعي") },
        { value: "luxury",  label: t("Luxury",  "فاخرة") },
        { value: "minivan", label: t("Minivan", "ميني فان") },
      ] },
    { key: "transmission", label: t("Transmission", "ناقل الحركة"),   dataType: "select", isRequired: true,  isFilterable: true,  filterWidget: "select", showInCard: true,  sortOrder: 5,
      options: [
        { value: "automatic", label: t("Automatic", "أوتوماتيك") },
        { value: "manual",    label: t("Manual",    "يدوي") },
      ] },
    { key: "fuel",         label: t("Fuel",         "الوقود"),         dataType: "select", isRequired: true,  isFilterable: true,  filterWidget: "select", showInCard: false, sortOrder: 6,
      options: [
        { value: "petrol",   label: t("Petrol",   "بنزين") },
        { value: "diesel",   label: t("Diesel",   "ديزل") },
        { value: "hybrid",   label: t("Hybrid",   "هجين") },
        { value: "electric", label: t("Electric", "كهربائية") },
      ] },
    { key: "seats",            label: t("Seats", "المقاعد"), dataType: "number",  unit: "seats", isRequired: true,  isFilterable: true, filterWidget: "range",  showInCard: true,  sortOrder: 7, validation: { min: 2, max: 9 } },
    { key: "doors",            label: t("Doors", "الأبواب"), dataType: "number",  isRequired: false, isFilterable: false, sortOrder: 8 },
    { key: "air_conditioning", label: t("Air conditioning", "تكييف"), dataType: "boolean", isRequired: false, isFilterable: true, filterWidget: "toggle", sortOrder: 9 },
    { key: "color",            label: t("Color", "اللون"),   dataType: "text",    isRequired: false, isFilterable: false, sortOrder: 10 },
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
    [PricingUnit.day,  { isDefault: true,  minQuantity: 1, maxQuantity: 90 }],
    [PricingUnit.week, { isDefault: false, minQuantity: 1, maxQuantity: 12 }],
  ] as const) {
    await prisma.categoryPricingUnit.upsert({
      where: { categoryId_unit: { categoryId: cars.id, unit } },
      update: {},
      create: { categoryId: cars.id, unit, ...def },
    });
  }

  // ── Extras ──────────────────────────────────────────────
  const extrasData = [
    { name: t("Child seat",      "مقعد أطفال"),     price: 20,  priceType: "per_unit"    as const },
    { name: t("GPS navigator",   "نظام ملاحة GPS"), price: 15,  priceType: "per_unit"    as const },
    { name: t("Full insurance",  "تأمين شامل"),     price: 100, priceType: "per_booking" as const },
    { name: t("Airport pick-up", "استقبال المطار"), price: 80,  priceType: "per_booking" as const },
  ];
  const existingExtras = await prisma.extra.count({ where: { categoryId: cars.id } });
  if (existingExtras === 0) {
    await prisma.extra.createMany({ data: extrasData.map((e) => ({ ...e, categoryId: cars.id })) });
  }

  // ── Drivers ─────────────────────────────────────────────
  const driverUsers = [
    { email: "driver.omar@renting.ru",  firstName: "Omar",  lastName: "Al-Rashid", phone: "+96600000010", languages: ["ar", "en"], yearsExperience: 10, hourlyRate: 40,  dailyRate: 250 },
    { email: "driver.amina@renting.ru", firstName: "Amina", lastName: "Hassan",    phone: "+96600000011", languages: ["ar", "en"], yearsExperience: 7,  hourlyRate: 45,  dailyRate: 280 },
  ];
  for (const d of driverUsers) {
    const u = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email, phone: d.phone, passwordHash: password,
        firstName: d.firstName, lastName: d.lastName, emailVerifiedAt: new Date(),
        roles: { create: { roleId: driverRole.id } },
      },
    });
    await prisma.driver.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        bio: t(
          `Professional chauffeur with ${d.yearsExperience} years of experience in the Gulf region.`,
          `سائق محترف بخبرة ${d.yearsExperience} سنوات في منطقة الخليج.`,
        ),
        languages: d.languages, yearsExperience: d.yearsExperience,
        hourlyRate: d.hourlyRate, dailyRate: d.dailyRate, commissionPercent: 20,
        schedules: { create: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dayOfWeek: dow, startTime: "07:00", endTime: "23:00" })) },
      },
    });
  }

  // ── Fleet ───────────────────────────────────────────────
  const fleet = [
    {
      slug: "toyota-camry-2024",
      title: t("Toyota Camry 2024", "تويوتا كامري 2024"),
      attributes: { brand: "toyota", model: "Camry", year: 2024, body_type: "sedan",  transmission: "automatic", fuel: "petrol", seats: 5, doors: 4, air_conditioning: true, color: "White" },
      prices: { hour: 35, day: 200, week: 1200 }, featured: true,
    },
    {
      slug: "bmw-x5-2024",
      title: t("BMW X5 2024", "بي إم دبليو X5 2024"),
      attributes: { brand: "bmw",     model: "X5",    year: 2024, body_type: "suv",    transmission: "automatic", fuel: "hybrid", seats: 5, doors: 5, air_conditioning: true, color: "Black" },
      prices: { hour: 70, day: 450, week: 2700 }, featured: true,
    },
    {
      slug: "mercedes-e-class-2024",
      title: t("Mercedes E-Class 2024", "مرسيدس الفئة E 2024"),
      attributes: { brand: "mercedes", model: "E 220", year: 2024, body_type: "luxury", transmission: "automatic", fuel: "petrol", seats: 5, doors: 4, air_conditioning: true, color: "Silver" },
      prices: { hour: 65, day: 400, week: 2400 }, featured: true,
    },
    {
      slug: "toyota-land-cruiser-2024",
      title: t("Toyota Land Cruiser 2024", "تويوتا لاند كروزر 2024"),
      attributes: { brand: "toyota",   model: "Land Cruiser 300", year: 2024, body_type: "suv", transmission: "automatic", fuel: "petrol", seats: 7, doors: 5, air_conditioning: true, color: "White" },
      prices: { hour: 90, day: 580, week: 3480 }, featured: true,
    },
    {
      slug: "lexus-es-350-2023",
      title: t("Lexus ES 350 2023", "لكزس ES 350 2023"),
      attributes: { brand: "lexus",    model: "ES 350", year: 2023, body_type: "luxury", transmission: "automatic", fuel: "petrol", seats: 5, doors: 4, air_conditioning: true, color: "Champagne" },
      prices: { hour: 60, day: 380, week: 2280 }, featured: true,
    },
    {
      slug: "kia-carnival-2024",
      title: t("Kia Carnival 2024", "كيا كرنفال 2024"),
      attributes: { brand: "kia",      model: "Carnival", year: 2024, body_type: "minivan", transmission: "automatic", fuel: "diesel", seats: 8, doors: 5, air_conditioning: true, color: "Gray" },
      prices: { hour: 45, day: 280, week: 1680 }, featured: false,
    },
  ];

  for (const [i, car] of fleet.entries()) {
    const images = CAR_IMAGES[car.slug] ?? [`https://placehold.co/1200x800?text=${encodeURIComponent((car.title as any).en)}`];
    const listing = await prisma.listing.upsert({
      where: { slug: car.slug },
      update: {
        title: car.title,
        attributes: car.attributes,
        isFeatured: car.featured,
        status: "active",
      },
      create: {
        categoryId: cars.id,
        slug: car.slug,
        title: car.title,
        description: t(
          `Well-maintained ${(car.title as any).en} available for self-drive or with a professional chauffeur across Saudi Arabia.`,
          `${(car.title as any).ar} بحالة ممتازة، متاحة للقيادة الذاتية أو مع سائق محترف في جميع أنحاء المملكة.`,
        ),
        status: "active",
        locationId: locations[i % locations.length].id,
        attributes: car.attributes,
        isFeatured: car.featured,
        prices: {
          create: Object.entries(car.prices).map(([unit, price]) => ({
            pricingUnit: unit as PricingUnit, currency: "SAR", basePrice: price,
          })),
        },
      },
    });

    // Always replace media so re-running the seed refreshes images
    await prisma.listingMedia.deleteMany({ where: { listingId: listing.id } });
    await prisma.listingMedia.createMany({
      data: images.map((url, n) => ({ listingId: listing.id, url, sortOrder: n, isCover: n === 0 })),
    });
  }

  // Summer peak pricing: +15% in July–August
  const existingRule = await prisma.priceRule.findFirst({ where: { name: "Summer peak" } });
  if (!existingRule) {
    await prisma.priceRule.create({
      data: {
        scope: "category", categoryId: cars.id, name: "Summer peak",
        startsOn: new Date("2026-07-01"), endsOn: new Date("2026-08-31"),
        adjustmentType: "percent", adjustmentValue: 15, priority: 10,
      },
    });
  }

  // ── Coupon ──────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10", type: "percent", value: 10, minAmount: 200, maxDiscount: 200,
      usageLimit: 1000, perUserLimit: 1,
      validFrom: new Date("2026-01-01"), validTo: new Date("2026-12-31"),
    },
  });

  // ── Settings ────────────────────────────────────────────
  const settings: Array<{ key: string; value: any; group: string; isPublic: boolean }> = [
    { key: "currencies", value: { default: "SAR", supported: ["SAR", "AED", "USD", "EUR"], rates: { SAR: 1, AED: 0.98, USD: 0.27, EUR: 0.25 } }, group: "money",      isPublic: true  },
    { key: "tax",        value: { percent: 15, label: "VAT" },                                                                                   group: "money",      isPublic: true  },
    { key: "branding",   value: { siteName: "Renting", supportEmail: "support@renting.sa", supportPhone: "+966 000 000 0000" },                  group: "general",    isPublic: true  },
    { key: "booking",    value: { autoConfirm: false },                                                                                           group: "operations", isPublic: false },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }

  // ── Content ─────────────────────────────────────────────
  await prisma.contentPage.upsert({
    where: { slug: "terms" },
    update: {},
    create: {
      slug: "terms",
      title: t("Terms & Conditions", "الشروط والأحكام"),
      body:  t("## Terms\nDemo terms content.", "## الشروط\nمحتوى تجريبي."),
      status: "published",
    },
  });
  await prisma.faq.createMany({
    data: [
      {
        question: t("Do I need a deposit?",       "هل أحتاج إلى وديعة؟"),
        answer:   t("Yes, a refundable security deposit (SAR 500) is held for all car rentals and returned within 3 business days.", "نعم، يتم حجز وديعة قابلة للاسترداد (500 ريال) لجميع تأجيرات السيارات وتُعاد خلال 3 أيام عمل."),
        group: "payments", sortOrder: 1,
      },
      {
        question: t("Can I rent with a driver?",    "هل يمكنني الاستئجار مع سائق؟"),
        answer:   t("Yes — choose 'With driver' during booking and select a chauffeur from our verified pool.", "نعم — اختر 'مع سائق' أثناء الحجز واختر سائقاً من قائمتنا المعتمدة."),
        group: "booking",  sortOrder: 2,
      },
      {
        question: t("What documents do I need?",   "ما المستندات المطلوبة؟"),
        answer:   t("A valid national ID or passport and a verified driver's license uploaded through your account.", "هوية وطنية سارية أو جواز سفر ورخصة قيادة موثقة مرفوعة عبر حسابك."),
        group: "booking",  sortOrder: 3,
      },
    ],
    skipDuplicates: true,
  });

  // ── Counters ─────────────────────────────────────────────
  await prisma.counter.upsert({ where: { key: "invoice" }, update: {}, create: { key: "invoice", value: 1000 } });
  await prisma.counter.upsert({ where: { key: "booking" }, update: {}, create: { key: "booking", value: 1000 } });

  console.log("Seed complete.");
  console.log("  super admin  : admin@renting.ru / Password1!");
  console.log("  customer     : customer@example.com / Password1!");
  console.log(`  admin id     : ${admin.id}`);
  console.log(`  customer id  : ${customer.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
