import { Logger, updateDebugFile } from "./common/Logger";
import { i18nInit, T, changeLanguage } from "./common/Translation";
import osLocale from "os-locale";
import yargs from "yargs";
import { stdout } from "process";
import { progressbar } from "neo-blessed";

(async () => {
    (global as any).LOCALE = await osLocale();
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

        stdout.write(`
    ███╗   ███╗██████╗ ██╗██████╗         ██╗███████╗
    ████╗ ████║██╔══██╗██║██╔══██╗        ██║██╔════╝
    ██╔████╔██║██║  ██║██║██████╔╝        ██║███████╗
    ██║╚██╔╝██║██║  ██║██║██╔══██╗   ██   ██║╚════██║
    ██║ ╚═╝ ██║██████╔╝██║██║  ██║██╗╚█████╔╝███████║
    ╚═╝     ╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝ ╚════╝ ╚══════╝`);

    if ( typeof(argv.logfile) !== "undefined" ) {
        (global as any).debug = true;
        console.log( "detect locale: " + (global as any).LOCALE );
        updateDebugFile( argv.logfile );
    }

    if ( argv.lang ) {
        await changeLanguage(argv.lang);
    }
    
    let mainFrame = (await import("./panel_blassed/MainFrame")).default();
    await mainFrame.start();
})();
