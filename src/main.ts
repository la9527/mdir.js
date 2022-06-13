import { updateDebugFile } from "./common/Logger.mjs";
import { i18nInit, T, changeLanguage } from "./common/Translation.mjs";
import yargs from "yargs";
import { stdout } from "process";
import Configure from "./config/Configure.mjs";
import { ColorConfig } from "./config/ColorConfig.mjs";
import colors from "colors";
import { StringUtils } from "./common/StringUtils.mjs";
import fs from "fs";
import path from "path";
import os from "os";
import { osLocale } from "os-locale";

(async () => {
    (global as any).LOCALE = await osLocale();
    await i18nInit( (global as any).LOCALE.match( /^ko/ ) ? "ko" : undefined );

    (global as any).fsTmpDir = fs.mkdtempSync( path.join(os.tmpdir(), "mdir-"), "utf8" );
    process.addListener("exit", () => {
        fs.rmdirSync((global as any).fsTmpDir, { recursive: true } );
    });
    
    let reargv = process.argv;
    if ( [ ".", "source" ].indexOf(reargv[0]) > -1 ) {
        reargv = process.argv.slice(2);
    }

    const argv = yargs( reargv )
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
            },
            "logsync": {
                alias: "s",
                describe: "Synchronize when saving the log file. \n(have must be '--logfile' option)",
                type: "string"
            }
        })
        .help()
        .argv;

    if ( argv.lang ) {
        await changeLanguage(argv.lang);
    }

    stdout.write(colors.green(`
    ███╗   ███╗██████╗ ██╗██████╗         ██╗███████╗
    ████╗ ████║██╔══██╗██║██╔══██╗        ██║██╔════╝
    ██╔████╔██║██║  ██║██║██████╔╝        ██║███████╗
    ██║╚██╔╝██║██║  ██║██║██╔══██╗   ██   ██║╚════██║
    ██║ ╚═╝ ██║██████╔╝██║██║  ██║██╗╚█████╔╝███████║
    ╚═╝     ╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝ ╚════╝ ╚══════╝\n\n`));

    if ( !fs.existsSync( path.join(os.homedir(), ".m") ) ) {
        fs.mkdirSync( path.join(os.homedir(), ".m") );
    }

    const colorConfig = ColorConfig.instance();
    const configure = Configure.instance();

    const consoleMessage = ( msg, highlightText ) => {
        stdout.write( colors.gray(msg) );
        stdout.write( Array(30 - StringUtils.strWidth( msg )).fill(" ").join("") );
        stdout.write( colors.gray("[") + colors.yellow(highlightText) + colors.gray("]") + "\n" );
    };

    if ( typeof(argv.logfile) !== "undefined" ) {
        (global as any).debug = true;
        updateDebugFile( argv.logfile, typeof(argv.logsync) !== "undefined" );
        consoleMessage( " * Debug mode", (global as any).DEBUG_INFO.file );
        consoleMessage( " * Debug sync", (global as any).DEBUG_INFO.sync );
    }
    consoleMessage( T("Start.SystemLocale"), (global as any).LOCALE );
    stdout.write( "\n" + T("Start.LoadConfigureFiles") + "\n" );
    consoleMessage( T("Start.LoadConfigure"), configure.getConfigPath() );
    consoleMessage( T("Start.LoadConfigureColor"), colorConfig.getConfigPath() );
    
    const mainFrame = (await import("./panel_blassed/MainFrame.mjs")).default();
    await mainFrame.start();
})();
