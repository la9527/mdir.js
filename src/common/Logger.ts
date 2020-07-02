// import { createLogger, format, transports, Logger } from "winston";
import path from "path";
import os from "os";
import moment from "moment";
import winston from "winston";
import * as fs from 'fs';

const { combine, timestamp, label, printf, prettyPrint } = winston.format;

let DEBUG_FILE = null;
export function updateDebugFile( filePath: string = "" ) {
    DEBUG_FILE = filePath || os.homedir() + path.sep + ".m" + path.sep + "m.log";
}

const myFormat = printf( (info) => {
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
        } catch ( e ) {
            // console.log( e );
        }
    }
    return `${moment().format("YY-MM-DD hh:mm:ss.SSS")} [${info.label.padEnd(10)}] ${level[info.level] || ""}: ${info.message}`;
  });

export function Logger( labelName: string ): winston.Logger {
    let logger = null;
    if ( DEBUG_FILE ) {
        let isColor = false;
        let stats = fs.lstatSync(DEBUG_FILE);
        if ( !stats.isFile() && stats.isCharacterDevice() ) {
            isColor = true;
        }
        logger = winston.createLogger({
            format: combine(
                label({ label: labelName }),
                winston.format.splat(),
                myFormat
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
