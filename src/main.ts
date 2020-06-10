import { Logger } from "./common/Logger";
import mainFrame from "./panel_blassed/MainFrame";

const log = Logger("main");

(async () => {
    await mainFrame().start();
})();
