import i18n from "i18next";
import I18nextCLILanguageDetector from "i18next-cli-language-detector";
import en from "../translation/en.json";
import ko from "../translation/ko.json";

export async function i18nInit() {
    await i18n.use(I18nextCLILanguageDetector).init({
        fallbackLng: "en",
        resources: { 
            en: { translation: en }, 
            ko: { translation: ko }
        },
        // lng: "ko",
    });
}

export function T( ...a ) {
    return i18n.t.apply( i18n, a );
};

