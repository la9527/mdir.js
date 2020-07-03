import { Logger, updateDebugFile } from "./common/Logger";
import { i18nInit, T, changeLanguage } from "./common/Translation";
import yargs from "yargs";

(async () => {
    await i18nInit();

    let argv = yargs
        .usage("Mdir.js is user-friendly graphic shell.")
        .options({
            "lang": {
                alias: "l",
                describe: T("Args.Lang"),
                choices: [ "en", "ko" ]
            },
            "logfile": {
                alias: "d",
                describe: T("Args.LogFile"),
                type: "string"
            }
        })
        .help()
        .argv;

    if ( typeof(argv.logfile) !== "undefined" ) {
        updateDebugFile( argv.logfile );
    }

    if ( argv.lang ) {
        await changeLanguage(argv.lang);
    }

    const log = Logger("main");
    log.debug( argv );

    let mainFrame = (await import("./panel_blassed/MainFrame")).default();
    await mainFrame.start();
})();
