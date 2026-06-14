type Template = { subject?: string; body: string };
type TemplateSet = Record<string, Record<string, Template>>; // key → locale → template

/** Lightweight {{var}} templates per locale. Swap for a full template engine when needed. */
export const TEMPLATES: TemplateSet = {
  welcome: {
    en: { subject: "Welcome to {{siteName}}", body: "Hi {{firstName}}, your account is ready. Happy renting!" },
    ru: { subject: "Добро пожаловать в {{siteName}}", body: "Здравствуйте, {{firstName}}! Ваш аккаунт создан." },
  },
  otp: {
    en: { body: "Your verification code: {{code}}" },
    ru: { body: "Ваш код подтверждения: {{code}}" },
  },
  password_reset: {
    en: { subject: "Password reset", body: "Use this token to reset your password: {{token}}" },
    ru: { subject: "Сброс пароля", body: "Токен для сброса пароля: {{token}}" },
  },
  booking_created: {
    en: { subject: "Booking {{code}} received", body: "We received your booking {{code}} for {{listingTitle}} ({{startAt}} → {{endAt}}). Total: {{total}} {{currency}}. We'll confirm shortly." },
    ru: { subject: "Бронирование {{code}} получено", body: "Мы получили вашу заявку {{code}} на {{listingTitle}} ({{startAt}} → {{endAt}}). Итого: {{total}} {{currency}}." },
  },
  booking_confirmed: {
    en: { subject: "Booking {{code}} confirmed", body: "Your booking {{code}} is confirmed. Pickup: {{startAt}}." },
    ru: { subject: "Бронирование {{code}} подтверждено", body: "Ваше бронирование {{code}} подтверждено. Начало: {{startAt}}." },
  },
  booking_cancelled: {
    en: { subject: "Booking {{code}} cancelled", body: "Your booking {{code}} has been cancelled. {{reason}}" },
    ru: { subject: "Бронирование {{code}} отменено", body: "Ваше бронирование {{code}} отменено. {{reason}}" },
  },
  booking_completed: {
    en: { subject: "Thanks for renting with us", body: "Booking {{code}} is complete. We'd love a review!" },
    ru: { subject: "Спасибо за аренду", body: "Бронирование {{code}} завершено. Будем рады отзыву!" },
  },
  booking_reminder: {
    en: { subject: "Reminder: booking {{code}} starts soon", body: "Your booking {{code}} starts at {{startAt}}." },
    ru: { subject: "Напоминание о бронировании {{code}}", body: "Ваше бронирование {{code}} начинается {{startAt}}." },
  },
  license_status: {
    en: { subject: "Driver's license verification", body: "Your license verification status: {{status}}. {{reason}}" },
    ru: { subject: "Проверка водительского удостоверения", body: "Статус проверки: {{status}}. {{reason}}" },
  },
  driver_assigned: {
    en: { subject: "New assignment {{code}}", body: "You have been assigned to booking {{code}}, starting {{startAt}}." },
    ru: { subject: "Новое назначение {{code}}", body: "Вам назначено бронирование {{code}}, начало {{startAt}}." },
  },
};

export function renderTemplate(key: string, locale: string, vars: Record<string, unknown>): Template {
  const set = TEMPLATES[key] ?? { en: { body: key } };
  const tpl = set[locale] ?? set.en ?? Object.values(set)[0];
  const interpolate = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
  return { subject: tpl.subject ? interpolate(tpl.subject) : undefined, body: interpolate(tpl.body) };
}
