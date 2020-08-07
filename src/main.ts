import { Logger, updateDebugFile } from "./common/Logger";
import { i18nInit, T, changeLanguage } from "./common/Translation";
import osLocale from "os-locale";
import yargs from "yargs";

(async () => {
    await i18nInit();

    let reargv = process.argv;
    if ( [ ".", "source" ].indexOf(reargv[0]) > -1 ) {
        reargv = process.argv.slice(2);
    }

    let argv = yargs( reargv )
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
        (global as any).debug = true;
        updateDebugFile( argv.logfile );
    }

    if ( argv.lang ) {
        await changeLanguage(argv.lang);
    }

    (global as any).LOCALE = await osLocale();
    /*
    const log = Logger("main");
    log.debug( argv );
    */

    let mainFrame = (await import("./panel_blassed/MainFrame")).default();
    await mainFrame.start();
})();
