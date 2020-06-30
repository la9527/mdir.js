import { Logger } from "./common/Logger";
import i18n from "i18next";
import I18nextCLILanguageDetector from 'i18next-cli-language-detector';
import en from "./translation/en.json";
import ko from "./translation/ko.json";

const log = Logger("main");

(async () => {
    await i18n.use(I18nextCLILanguageDetector).init({
        fallbackLng: "en",
        resources: { 
            en: { translation: en }, 
            ko: { translation: ko }
        },
        // lng: "ko",
    });

    log.debug( "START !!!" );

    (await import("./panel_blassed/MainFrame")).default().start();
})();
