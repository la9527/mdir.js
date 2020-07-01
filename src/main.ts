import { Logger, updateDebugFile } from "./common/Logger";
import { i18nInit } from "./common/Translation";
import yargs from "yargs";

(async () => {
    let argv = yargs
        .usage("Mdir.js is user-friendly graphic shell.")
        .options({
            "lang": {
                alias: "l",
                describe: "set a language. (default: auto detect locale)",
                choices: [ "en", "ko" ]
            },
            "logfile": {
                alias: "d",
                describe: "Saves debugging messages to a file. (default: ~/.m/m.log)",
                type: "string"
            }
        })
        .help()
        .argv;

    if ( typeof(argv.logfile) !== "undefined" ) {
        updateDebugFile( argv.logfile );
    }

    const log = Logger("main");
    log.debug( argv );

    await i18nInit(argv.lang);
    (await import("./panel_blassed/MainFrame")).default().start();
})();
