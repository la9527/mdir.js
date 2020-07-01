import { Logger } from "./common/Logger";
import { i18nInit } from "./common/Translation";

const log = Logger("main");

(async () => {
    await i18nInit();

    (await import("./panel_blassed/MainFrame")).default().start();
})();
