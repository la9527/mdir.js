// import { createLogger, format, transports, Logger } from "winston";
import path from "path";
import * as os from "os";
import * as moment from "moment";
import * as winston from "winston";

const { combine, timestamp, label, printf, prettyPrint } = winston.format;

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

export function Logger( labelName: string ): winston.Logger {
    const logger = winston.createLogger({
        format: combine(
            label({ label: labelName }),
            winston.format.splat(),
            myFormat
        ),
        transports: [
            new winston.transports.File({
                level: "debug",
                filename: os.homedir() + "/.m/m.log"
            })
        ]
    });

    /*
    const buildType = process.env.BUILD_TYPE || "release";
    if ( buildType === "release" ) {
        logger.add( new winston.transports.Console( { level: "debug", handleExceptions: true, debugStdout: true }) );
    }
    */
    return logger;
}
