import { Injectable, Logger } from "@nestjs/common";
import { config } from "../../config/config";
import { SettingsService } from "../settings/settings.service";

export interface ListingModerationInput {
  title: Record<string, string>;
  description?: Record<string, string> | null;
  imageUrls: string[];
  tags: string[];
}

export interface ListingModerationResult {
  enabled: boolean;
  status: "not_checked" | "passed" | "flagged" | "failed";
  score: number;
  warnings: Array<{ category: string; message: string; severity: "low" | "medium" | "high" }>;
  raw?: unknown;
}

@Injectable()
export class ListingModerationService {
  private readonly logger = new Logger(ListingModerationService.name);

  constructor(private readonly settings: SettingsService) {}

  async analyze(input: ListingModerationInput): Promise<ListingModerationResult> {
    const enabled = await this.settings.get<boolean>("ai_moderation_enabled", false);
    if (!enabled) return { enabled: false, status: "not_checked", score: 0, warnings: [] };

    const settingKey = await this.settings.get<string | null>("openrouter_api_key", null);
    const apiKey = settingKey || config().OPENROUTER_API_KEY;
    if (!apiKey) {
      return {
        enabled: true,
        status: "failed",
        score: 0,
        warnings: [{ category: "configuration", message: "OpenRouter API key is not configured.", severity: "high" }],
      };
    }

    const model = await this.settings.get<string>("openrouter_model", config().OPENROUTER_MODEL);
    const prompt = [
      "You are moderating a car-rental marketplace listing.",
      "Flag prohibited, misleading, inappropriate, unethical, unsafe, abusive, or non-car-related listings.",
      "Respond with strict JSON: {\"score\":0-100,\"warnings\":[{\"category\":\"...\",\"message\":\"...\",\"severity\":\"low|medium|high\"}]}",
      `Title: ${JSON.stringify(input.title)}`,
      `Description: ${JSON.stringify(input.description ?? {})}`,
      `Tags: ${input.tags.join(", ") || "(none)"}`,
      `Image URLs: ${input.imageUrls.join(", ") || "(none)"}`,
    ].join("\n");

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "http-referer": "https://renting.ru",
          "x-title": "Renting Marketplace Moderation",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Return only valid JSON. Do not include markdown." },
            { role: "user", content: prompt },
          ],
          temperature: 0,
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter returned ${res.status}`);
      const body: any = await res.json();
      const text = body?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, ""));
      const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
      const highRisk = warnings.some((w: any) => w.severity === "high");
      const score = Math.max(0, Math.min(100, Number(parsed.score ?? (warnings.length ? 70 : 0))));
      return {
        enabled: true,
        status: highRisk || score >= 70 || warnings.length > 0 ? "flagged" : "passed",
        score,
        warnings: warnings.map((w: any) => ({
          category: String(w.category ?? "moderation"),
          message: String(w.message ?? "Suspicious content"),
          severity: ["low", "medium", "high"].includes(w.severity) ? w.severity : "medium",
        })),
        raw: body,
      };
    } catch (e: any) {
      this.logger.warn(`OpenRouter moderation failed: ${e.message}`);
      return {
        enabled: true,
        status: "failed",
        score: 0,
        warnings: [{ category: "moderation", message: `AI moderation failed: ${e.message}`, severity: "medium" }],
      };
    }
  }
}
