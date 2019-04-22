import { createLogger, format, transports, Logger } from "winston";
import path from "path";
import * as moment from "moment";
import winston = require("winston");

const { combine, timestamp, label, printf, prettyPrint } = format;

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
    return `${moment().format("YY-MM-DD hh:mm:ss")} ${level[info.level] || ""}: ${info.message}`;
  });

export function Logger( labelName: string ): Logger {
    const logger = createLogger({
        format: combine(
            label({ label: labelName }),
            format.splat(),
            myFormat
        ),
        transports: [
            new winston.transports.File({
                level: "debug",
                filename: process.env.HOME + "/.m/m.log"
            })
        ]
    });

    /*
    const buildType = process.env.BUILD_TYPE || "release";
    if ( buildType === "release" ) {
        logger.add( new transports.Console( { level: "debug", handleExceptions: true, debugStdout: true }) );
    }
    */
    return logger;
}
