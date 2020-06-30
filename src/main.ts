import { Logger } from "./common/Logger";
import mainFrame from "./panel_blassed/MainFrame";
import i18next from "i18next";
import I18nextCLILanguageDetector from 'i18next-cli-language-detector';
import en from "./translation/en.json";
import ko from "./translation/ko.json";

const log = Logger("main");

(async () => {
    i18next.use(I18nextCLILanguageDetector).init({
        resources: { en, ko }
    });

    await mainFrame().start();
})();
