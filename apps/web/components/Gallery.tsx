"use client";

import { useState } from "react";

export function Gallery({ media, alt }: { media: Array<{ url: string }>; alt: string }) {
  const [active, setActive] = useState(0);
  if (media.length === 0) return null;
  return (
    <div>
      <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media[active]?.url} alt={alt} className="h-full w-full object-cover" />
      </div>
      {media.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {media.map((m, i) => (
            <button
              key={m.url}
              onClick={() => setActive(i)}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${i === active ? "border-brand-500" : "border-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
