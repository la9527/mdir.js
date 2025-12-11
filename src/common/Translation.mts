/* eslint-disable prefer-spread */
import i18n from "i18next";
import I18nextCLILanguageDetector from "i18next-cli-language-detector";
import { CJSRequire } from "./CommonJSRequire.mjs";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const translationBases = [
    path.resolve(__dirname, "../translation"),
    path.resolve(__dirname, "../../translation"),
    path.resolve(__dirname, "../../../translation"),
    path.resolve(__dirname, "../../../src/translation")
];

function resolveTranslationFile(fileName: string): string {
    for ( const baseDir of translationBases ) {
        const candidate = path.join(baseDir, fileName);
        if ( fs.existsSync(candidate) ) {
            return candidate;
        }
    }
    throw new Error(`Translation resource not found: ${fileName}`);
}

const en = CJSRequire(resolveTranslationFile("en.json"));
const ko = CJSRequire(resolveTranslationFile("ko.json"));

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
