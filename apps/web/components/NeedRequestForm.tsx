"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authedApi, getUser } from "../lib/auth";

export function NeedRequestForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string } | null>(null);
  const ar = locale === "ar";
  const draftKey = "renting.transportationNeedDraft";
  const examples = ar
    ? [
        "توصيل أطفالي كل يوم دراسي من مدرسة XXX الساعة 12 ظهراً إلى المنزل في الحي 1",
        "أحتاج سيارة مع سائق من المنزل إلى العمل من الأحد إلى الخميس الساعة 7 صباحاً",
        "استقبال عائلتي من المطار يوم الجمعة الساعة 10 مساءً مع مساحة لـ 5 حقائب",
      ]
    : [
        "Drive my kids every school day from XXX School at noon to our home in District 1",
        "I need a car with a driver from home to work, Sunday–Thursday at 7 AM",
        "Pick up my family from the airport Friday at 10 PM, with room for 5 bags",
      ];

  useEffect(() => {
    const draft = sessionStorage.getItem(draftKey);
    if (draft) {
      setDescription(draft);
      sessionStorage.removeItem(draftKey);
    }
  }, []);

  const submit = async () => {
    if (!getUser()) {
      sessionStorage.setItem(draftKey, description);
      router.push(`/${locale}/login?next=/${locale}#register-need`);
      return;
    }
    if (description.trim().length < 10) {
      setError(ar ? "صِف احتياجك بمزيد من التفاصيل." : "Please describe your need in a little more detail.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await authedApi<{ code: string }>("/needs", {
        method: "POST", body: { description: description.trim(), locale },
      });
      setCreated(data);
      setDescription("");
    } catch (e: any) {
      setError(e.message ?? "Could not register the need");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="register-need" className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-lg shadow-blue-950/5">
      <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 to-blue-800 p-8 text-white sm:p-10">
          <div className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full border-[30px] border-white/5" />
          <div className="relative">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8m-8 4h5m8-2a9 9 0 11-3.3-6.96L21 4v8z" />
              </svg>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">{ar ? "اطلب بطريقتك" : "Tell us in your words"}</p>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight">{ar ? "لديك مشوار متكرر أو طلب خاص؟" : "A recurring ride or something unusual?"}</h2>
            <p className="mt-4 text-sm leading-6 text-blue-100">
              {ar ? "لا تبحث بين عشرات الخيارات. صف المشوار وسيتولى فريقنا إيجاد الحل المناسب." : "Skip the filters. Describe the trip and our team will find the right transport solution."}
            </p>

            <ol className="mt-8 space-y-4 text-sm">
              {[
                ar ? "اكتب نقطة الانطلاق والوجهة" : "Include pickup and destination",
                ar ? "أضف الأيام والوقت وعدد الركاب" : "Add days, time, and passengers",
                ar ? "سنراجع الطلب ونتواصل معك" : "We review it and contact you",
              ].map((item, index) => (
                <li key={item} className="flex items-center gap-3 text-blue-50">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">{index + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="p-6 sm:p-10">
          {created ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 ring-8 ring-green-50">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" /></svg>
              </div>
              <p className="mt-6 text-xl font-extrabold text-gray-900">{ar ? "وصلنا طلبك" : "We’ve got your request"}</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">{ar ? "سيراجع فريقنا التفاصيل ويتواصل معك عند إيجاد الخيار المناسب." : "Our team will review the details and contact you when we find a suitable option."}</p>
              <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-600">{ar ? "الرقم المرجعي" : "Reference number"}</p>
                <p className="mt-1 font-mono text-lg font-bold text-green-800">{created.code}</p>
              </div>
              <Link href={`/${locale}/account/needs`} className="btn-primary mt-6">
                {ar ? "متابعة احتياجاتي" : "Track my needs"}
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-lg font-extrabold text-gray-900">{ar ? "صِف المشوار" : "Describe the ride"}</p>
                  <p className="mt-1 text-sm text-gray-500">{ar ? "جملة واحدة تكفي للبدء." : "One clear sentence is enough to get started."}</p>
                </div>
                <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700 sm:block">{ar ? "دقيقة واحدة" : "Takes 1 minute"}</span>
              </div>

              <div className="relative mt-5">
                <svg className="absolute start-4 top-4 h-5 w-5 text-brand-400" viewBox="0 0 24 24" fill="currentColor"><path d="M7.17 6A5.17 5.17 0 002 11.17V18h7v-7H5.11A2.17 2.17 0 017.17 9H9V6H7.17zm10 0A5.17 5.17 0 0012 11.17V18h7v-7h-3.89A2.17 2.17 0 0117.17 9H19V6h-1.83z" /></svg>
                <textarea
                  className="input min-h-36 resize-y !rounded-2xl !border-gray-200 !px-12 !py-4 text-base leading-7"
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={ar ? "مثال: توصيل أطفالي كل يوم دراسي من مدرسة XXX الساعة 12 ظهراً إلى المنزل في الحي 1" : "Example: Drive my kids every school day from XXX School at noon to our home in District 1"}
                  aria-label={ar ? "وصف احتياج النقل" : "Transportation need description"}
                />
                <span className="absolute bottom-3 end-4 text-[11px] text-gray-400">{description.length}/2000</span>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-gray-500">{ar ? "أو ابدأ بمثال:" : "Or start with an example:"}</p>
                <div className="flex flex-wrap gap-2">
                  {examples.map((example, index) => (
                    <button key={example} type="button" onClick={() => { setDescription(example); setError(null); }}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand-300 hover:bg-blue-50 hover:text-brand-700">
                      {index === 0 ? (ar ? "🏫 مشوار المدرسة" : "🏫 School run") : index === 1 ? (ar ? "💼 الذهاب للعمل" : "💼 Work commute") : (ar ? "✈️ استقبال المطار" : "✈️ Airport pickup")}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center">
                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.6-4.8A11.9 11.9 0 0112 2a11.9 11.9 0 01-8.6 3.2A12 12 0 003 9c0 5.6 3.8 10.3 9 11.7 5.2-1.4 9-6.1 9-11.7 0-1.3-.1-2.6-.4-3.8z" /></svg>
                  {ar ? "لن يتم الحجز أو الخصم الآن" : "No booking or charge is made now"}
                </p>
                <button className="btn-primary !px-6 !py-3" disabled={busy || description.trim().length < 10} onClick={submit}>
                  {busy ? (ar ? "جارٍ الإرسال…" : "Submitting…") : (ar ? "إرسال الاحتياج" : "Send my request")}
                  {!busy && <svg className="h-4 w-4 rtl:rotate-180" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.3 3.3a1 1 0 011.4 0l6 6a1 1 0 010 1.4l-6 6a1 1 0 01-1.4-1.4l4.3-4.3H3a1 1 0 110-2h11.6l-4.3-4.3a1 1 0 010-1.4z" clipRule="evenodd" /></svg>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
