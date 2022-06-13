/* eslint-disable @typescript-eslint/no-unused-vars */
import path from "path";
import os from "os";
import winston, { log } from "winston";
import fs from "fs";

const { combine, timestamp, label, printf, prettyPrint } = winston.format;

export function updateDebugFile( filePath: string = "", sync: boolean = false ) {
    (global as any).DEBUG_INFO = {
        stdout: false,
        file: filePath || os.homedir() + path.sep + ".m" + path.sep + "m.log",
        sync
    };
}

if ( process.env.NODE_ENV === "test" && !(global as any).DEBUG_INFO ) {
    updateDebugFile();
}

function initLogger() {
    let logger = null;
    const transports: any[] = [];
    let isColor = false;

    const debugInfo = (global as any).DEBUG_INFO || {};

    if ( debugInfo.stdout ) {
        isColor = true;
        transports.push( new (winston.transports as any).Console({level: "debug", handleExceptions: true, handleRejections: true }) );
    } else {
        if ( os.platform() === "win32" ) {
            isColor = true;
        } else {
            try {
                const stats = fs.lstatSync(debugInfo.file);
                if ( !stats.isFile() && stats.isCharacterDevice() ) {
                    isColor = true;
                }
            } catch ( e ) {
                isColor = false;
            }
        }
        transports.push( new (winston.transports as any).File({
            level: "debug",
            filename: debugInfo.file,
            handleExceptions: true,
            handleRejections: true
        }));
    }

    const format = combine(
        label({ label: "common" }),
        winston.format.splat(),
        winston.format.timestamp( { format: "HH:mm:ss.SSS" }),
        winston.format.simple(),
        winston.format.printf( (info) => {
            const level = {
                error: "E",
                warn: "W",
                info: "I",
                verbose: "V",
                debug: "D",
                silly: "S"
            };
            if ( typeof(info.message) === "object" ) {
                if ( info.message && typeof((info.message as any).toString) === "function" ) {
                    info.message = (info.message as any).toString();
                } else {
                    try {
                        info.message = JSON.stringify( info.message );
                    // eslint-disable-next-line no-empty
                    } catch ( e ) {}
                }
            }
            let result = "";
            const labelName = info.labelName ? `[${info.labelName.padEnd(10)}]` : "";
            if ( isColor ) {
                result = `${info.timestamp} ${labelName}${level[info.level] || ""}: ` + winston.format.colorize().colorize(info.level, info.message);
                return result;
            }
            result = `${info.timestamp} ${labelName}${level[info.level] || ""}: ${info.message}`;
            return result;
        })
    );

    logger = winston.createLogger({
        format,
        transports
    });
    return logger;
}

export function Logger( labelName: string ): winston.Logger {
    if ( !(global as any).M_LOGGER ) {
        (global as any).M_LOGGER = winston.createLogger( { silent: true } );
    }
    const debugInfo = (global as any).DEBUG_INFO;
    if ( debugInfo ) {
        if ( (global as any).M_LOGGER.silent ) {
            (global as any).M_LOGGER = initLogger();
        }
    }
    const logger = (global as any).M_LOGGER;
    if ( !debugInfo || debugInfo.sync ) {
        return logger;
    }
    return logger.child( { labelName } );
}
