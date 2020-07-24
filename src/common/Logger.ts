import path from "path";
import os from "os";
import winston from "winston";
import * as fs from 'fs';

const { combine, timestamp, label, printf, prettyPrint } = winston.format;

let DEBUG_FILE = null;
if ( process.env.NODE_ENV === "test" ) {
    DEBUG_FILE = os.homedir() + path.sep + ".m" + path.sep + "m.log";
}

export function updateDebugFile( filePath: string = "" ) {
    DEBUG_FILE = filePath || os.homedir() + path.sep + ".m" + path.sep + "m.log";
    console.log( "DEBUG OUT >" + DEBUG_FILE );
}

export function Logger( labelName: string ): winston.Logger {
    let logger = null;
    if ( DEBUG_FILE ) {
        let isColor = false;
        try {
            let stats = fs.lstatSync(DEBUG_FILE);
            if ( !stats.isFile() && stats.isCharacterDevice() ) {
                isColor = true;
            }
        } catch ( e ) {
            isColor = false;
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
                        try {
                            info.message = JSON.stringify( info.message );
                        } catch ( e ) {}
                    }
                    let item = `${info.timestamp} - [${info.label.padEnd(10)}] ${level[info.level] || ""}: ${info.message}`;
                    if ( isColor ) {
                        return winston.format.colorize().colorize(info.level, item);
                    }
                    return item;
                })
            ),
            transports: [
                new winston.transports.File({
                    level: "debug",
                    filename: DEBUG_FILE
                })
            ]
        });
    } else {
        logger = winston.createLogger( { silent: true } );
    }
    return logger;
}
