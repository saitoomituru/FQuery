import { createContext, useContext } from "react";

export type PlaygroundLocale = "ja-JP" | "en-US";
export type MessageKey = "app.title" | "app.lastEvent" | "app.frameAll" | "unit.replace" | "unit.why" | "unit.details" | "unit.dimension" | "unit.evidence" | "lambda.stale" | "lambda.empty";

const messages: Readonly<Record<PlaygroundLocale, Readonly<Record<MessageKey, string>>>> = Object.freeze({
  "ja-JP": Object.freeze({
    "app.title": "FQuery Playground — Ψ.NL → ∇φ.FAMVIM → λ.NL", "app.lastEvent": "最終event", "app.frameAll": "全体表示",
    "unit.replace": "選択unitだけ差替え", "unit.why": "Whyを再分解", "unit.details": "詳細 / FoldLog", "unit.dimension": "次元", "unit.evidence": "Access Mapper / evidence",
    "lambda.stale": "再構成待ち — stale λ投影は出力しない", "lambda.empty": "未提供 — 上流FAMから出力がまだ投影されていない",
  }),
  "en-US": Object.freeze({
    "app.title": "FQuery Playground — Ψ.NL → ∇φ.FAMVIM → λ.NL", "app.lastEvent": "last event", "app.frameAll": "Frame all",
    "unit.replace": "Replace selected unit", "unit.why": "Decompose Why", "unit.details": "Details / FoldLog", "unit.dimension": "dimension", "unit.evidence": "Access Mapper / evidence",
    "lambda.stale": "Recomposition required — stale λ projection is blocked", "lambda.empty": "NOT PROVIDED — no upstream FAM projection yet",
  }),
});

export interface LocalizationValue { readonly locale: PlaygroundLocale; readonly t: (key: MessageKey) => string }
export const LocalizationContext = createContext<LocalizationValue>({ locale: "ja-JP", t: (key: MessageKey) => messages["ja-JP"][key] });
export function createLocalization(locale: PlaygroundLocale): LocalizationValue { return Object.freeze({ locale, t: (key: MessageKey) => messages[locale][key] }); }
export function useLocalization(): LocalizationValue { return useContext(LocalizationContext); }
