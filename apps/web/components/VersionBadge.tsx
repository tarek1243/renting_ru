"use client";

import { useEffect, useState } from "react";

export function VersionBadge({
  className,
  initialVersion,
  locale,
}: {
  className: string;
  initialVersion: string;
  locale: string;
}) {
  const [version, setVersion] = useState(initialVersion);

  useEffect(() => {
    let mounted = true;

    fetch("/api/version", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && typeof data?.version === "string" && data.version.trim()) {
          setVersion(data.version);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <span
      className={className}
      title={locale === "ar" ? `إصدار التطبيق ${version}` : `App version ${version}`}
      aria-label={locale === "ar" ? `الإصدار ${version}` : `Version ${version}`}
    >
      v{version}
    </span>
  );
}
