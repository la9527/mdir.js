import path from "path";
import os from "os";
import winston from "winston";
import * as fs from 'fs';

const { combine, timestamp, label, printf, prettyPrint } = winston.format;

if ( process.env.NODE_ENV === "test" && !(global as any).DEBUG_FILE ) {
    (global as any).DEBUG_FILE = os.homedir() + path.sep + ".m" + path.sep + "m.log";
}

export function updateDebugFile( filePath: string = "" ) {
    (global as any).DEBUG_FILE = filePath || os.homedir() + path.sep + ".m" + path.sep + "m.log";
    console.log( "DEBUG OUT >" + (global as any).DEBUG_FILE );
}

export function Logger( labelName: string ): winston.Logger {
    let logger = null;
    if ( (global as any).DEBUG_FILE || (global as any).DEBUG_STDOUT ) {
        let transports: any[] = [];
        let isColor = false;
        if ( (global as any).DEBUG_STDOUT ) {
            isColor = true;
            transports.push( new winston.transports.Console({level: "debug"}) );
        } else {
            try {
                let stats = fs.lstatSync((global as any).DEBUG_FILE);
                if ( !stats.isFile() && stats.isCharacterDevice() ) {
                    isColor = true;
                }
            } catch ( e ) {
                isColor = false;
            }
            transports.push( new winston.transports.File({
                level: "debug",
                filename: (global as any).DEBUG_FILE
            }));
        }

        logger = winston.createLogger({
            format: combine(
                label({ label: labelName }),
                winston.format.splat(),
                winston.format.timestamp( { format: "YY-MM-DD hh:mm:ss.SSS" }),
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
                            } catch ( e ) {}
                        }
                    }
                    if ( isColor ) {
                        return `${info.timestamp} - [${info.label.padEnd(10)}] ${level[info.level] || ""}: ` + winston.format.colorize().colorize(info.level, info.message);
                    }
                    return `${info.timestamp} - [${info.label.padEnd(10)}] ${level[info.level] || ""}: ${info.message}`;
                })
            ),
            transports
        });
    } else {
        logger = winston.createLogger( { silent: true } );
    }
    return logger;
}
