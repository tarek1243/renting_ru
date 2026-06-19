export const LOCALES = ["en", "ru", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const RTL_LOCALES = new Set(["ar"]);

const dict = {
  en: {
    home: "Home", search: "Search", myBookings: "My bookings", favorites: "Favorites",
    account: "Account", login: "Log in", register: "Sign up", logout: "Log out",
    featured: "Featured vehicles", browseAll: "Browse all", perDay: "/day", from: "From",
    bookNow: "Book now", withDriver: "With driver", selfDrive: "Self-drive",
    pickupDate: "Pickup", returnDate: "Return", location: "Location", extras: "Extras",
    priceSummary: "Price summary", total: "Total", deposit: "Security deposit (refundable)",
    coupon: "Coupon code", apply: "Apply", payOnline: "Pay online", payOnPickup: "Pay on pickup",
    confirmBooking: "Confirm booking", reviews: "Reviews", specs: "Specifications",
    availability: "Availability", filters: "Filters", clear: "Clear", showResults: "Show results",
    cancel: "Cancel booking", modify: "Modify", invoice: "Invoice", status: "Status",
    profile: "Profile", license: "Driver's license", licenseStatus: "Verification status",
    email: "Email", phone: "Phone", password: "Password", firstName: "First name", lastName: "Last name",
    chooseDriver: "Choose your chauffeur", anyDriver: "Best available", years: "yrs",
    noResults: "Nothing matches your filters", priceRange: "Price range", min: "Min", max: "Max",
    loading: "Loading…", save: "Save", uploaded: "Submitted for review", terms: "Terms", faq: "FAQ",
    myListings: "My listings", listYourCar: "List your car", addListing: "Add listing",
    listingTitle: "Listing title", pricePerDay: "Price / day", submitListing: "Submit listing",
    listingSubmitted: "Submitted for review — we'll notify you once published.",
    editListing: "Edit listing", deleteListing: "Delete", noListings: "No listings yet.",
  },
  ru: {
    home: "Главная", search: "Поиск", myBookings: "Мои бронирования", favorites: "Избранное",
    account: "Аккаунт", login: "Войти", register: "Регистрация", logout: "Выйти",
    featured: "Популярные автомобили", browseAll: "Смотреть все", perDay: "/день", from: "От",
    bookNow: "Забронировать", withDriver: "С водителем", selfDrive: "Без водителя",
    pickupDate: "Получение", returnDate: "Возврат", location: "Локация", extras: "Дополнительно",
    priceSummary: "Стоимость", total: "Итого", deposit: "Залог (возвращается)",
    coupon: "Промокод", apply: "Применить", payOnline: "Оплатить онлайн", payOnPickup: "Оплата при получении",
    confirmBooking: "Подтвердить бронирование", reviews: "Отзывы", specs: "Характеристики",
    availability: "Доступность", filters: "Фильтры", clear: "Сбросить", showResults: "Показать",
    cancel: "Отменить бронь", modify: "Изменить", invoice: "Счёт", status: "Статус",
    profile: "Профиль", license: "Водительское удостоверение", licenseStatus: "Статус проверки",
    email: "Email", phone: "Телефон", password: "Пароль", firstName: "Имя", lastName: "Фамилия",
    chooseDriver: "Выберите водителя", anyDriver: "Лучший доступный", years: "лет",
    noResults: "По фильтрам ничего не найдено", priceRange: "Цена", min: "Мин", max: "Макс",
    loading: "Загрузка…", save: "Сохранить", uploaded: "Отправлено на проверку", terms: "Условия", faq: "Вопросы",
    myListings: "Мои объявления", listYourCar: "Разместить авто", addListing: "Добавить объявление",
    listingTitle: "Название", pricePerDay: "Цена / день", submitListing: "Отправить",
    listingSubmitted: "Отправлено на проверку — уведомим после публикации.",
    editListing: "Редактировать", deleteListing: "Удалить", noListings: "Объявлений пока нет.",
  },
  ar: {
    home: "الرئيسية", search: "بحث", myBookings: "حجوزاتي", favorites: "المفضلة",
    account: "الحساب", login: "تسجيل الدخول", register: "إنشاء حساب", logout: "تسجيل الخروج",
    featured: "سيارات مميزة", browseAll: "تصفح الكل", perDay: "/يوم", from: "من",
    bookNow: "احجز الآن", withDriver: "مع سائق", selfDrive: "قيادة ذاتية",
    pickupDate: "الاستلام", returnDate: "الإرجاع", location: "الموقع", extras: "إضافات",
    priceSummary: "ملخص السعر", total: "الإجمالي", deposit: "وديعة (قابلة للاسترداد)",
    coupon: "رمز الخصم", apply: "تطبيق", payOnline: "ادفع أونلاين", payOnPickup: "الدفع عند الاستلام",
    confirmBooking: "تأكيد الحجز", reviews: "التقييمات", specs: "المواصفات",
    availability: "التوفر", filters: "تصفية", clear: "مسح", showResults: "عرض النتائج",
    cancel: "إلغاء الحجز", modify: "تعديل", invoice: "الفاتورة", status: "الحالة",
    profile: "الملف الشخصي", license: "رخصة القيادة", licenseStatus: "حالة التحقق",
    email: "البريد الإلكتروني", phone: "الهاتف", password: "كلمة المرور", firstName: "الاسم الأول", lastName: "اسم العائلة",
    chooseDriver: "اختر سائقك", anyDriver: "الأفضل المتاح", years: "سنوات",
    noResults: "لا نتائج مطابقة", priceRange: "نطاق السعر", min: "أدنى", max: "أقصى",
    loading: "جارٍ التحميل…", save: "حفظ", uploaded: "أُرسلت للمراجعة", terms: "الشروط", faq: "الأسئلة الشائعة",
  },
} as const;

export type UiKey = keyof (typeof dict)["en"];

export function ui(locale: string): (key: UiKey) => string {
  const table = (dict as Record<string, Record<string, string>>)[locale] ?? dict.en;
  return (key: UiKey) => table[key] ?? dict.en[key] ?? key;
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
