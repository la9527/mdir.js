/* eslint-disable prefer-spread */
import i18n from "i18next";
import I18nextCLILanguageDetector from "i18next-cli-language-detector";
import { CJSRequire } from "./CommonJSRequire.mjs";

const en = CJSRequire("../translation/en.json");
const ko = CJSRequire("../translation/ko.json");

export async function i18nInit( defaultLang: string = null ) {
    await i18n.use(I18nextCLILanguageDetector as any).init({
        fallbackLng: "en",
        resources: { 
            en: { translation: en }, 
            ko: { translation: ko }
        },
        lng: defaultLang
    });
}

export async function changeLanguage( lang: string ) {
    await i18n.changeLanguage( lang );
}

export function T( ...a ): string {
    return i18n.t.apply( i18n, a );
}
