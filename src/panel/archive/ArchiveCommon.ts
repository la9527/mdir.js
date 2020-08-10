import * as jschardet from "jschardet";
import * as iconv from "iconv-lite";
import * as path from "path";
import * as fs from "fs";

import { Reader, ProgressFunc, IMountList } from "../../common/Reader";
import { File } from "../../common/File";
import { Logger } from "../../common/Logger";
import { Readable, Transform } from "stream";
import { convertAttrToStatMode } from "../FileReader";
import { rejects } from "assert";
import { stream } from "winston";

const log = Logger("Archive");

export abstract class ArchiveCommon {
    protected originalFile: File = null;
    protected supportType: string = null;

    public setFile( file: File ): boolean {
        if ( !file ) {
            return false;
        }
        this.originalFile = file;
        this.supportType = this.isSupportType( file );
        return !!this.supportType;
    }

    public getSupportType(): string {
        return this.supportType;
    }

    protected abstract isSupportType( file: File ): string;
    public abstract getArchivedFiles(progress?: ProgressFunc): Promise<File[]>;

    public abstract compress( files: File[], progress?: ProgressFunc ): Promise<void>;
    public abstract uncompress( extractDir: File, files ?: File[], progress?: ProgressFunc ): Promise<void>;

    protected fileStreamWrite(extractDir: File, filesBaseDir: string, file: File, readStream: Readable, reportProgress: Transform, next: (status: string, err?:any) => void) {
        try {
            let filename = extractDir.fullname + ((filesBaseDir && filesBaseDir !== "/") ? file.fullname.substr(filesBaseDir.length) : file.fullname);
            let dirname = path.dirname(filename);
            let mode = convertAttrToStatMode(file);

            // console.log( filename, dirname );            
            if ( !fs.existsSync( dirname ) ) {
                fs.mkdirSync( dirname, { recursive: true });
            }

            if ( fs.existsSync( filename ) ) {
                next( "error", "file exist: " + filename );
                return;
            }

            if ( file.link ) {
                fs.unlinkSync( filename );
                fs.symlinkSync( filename, file.link.name, file.dir ? "dir" : "file" );
                fs.utimesSync(filename, file.atime || new Date(), file.mtime || new Date());
                readStream && readStream.resume();
                next("link");
            } else if ( file.dir && !file.link ) {
                fs.mkdirSync( filename, { recursive: true, mode });
                fs.chownSync( filename, file.uid, file.gid );
                fs.utimesSync(filename, file.atime || new Date(), file.mtime || new Date());
                readStream && readStream.resume();
                next("directory");
            } else if ( readStream ) {
                let writeStream = fs.createWriteStream(filename, { mode });
                let rejectFunc = (err) => {
                    readStream.destroy();
                    writeStream.end(() => {
                        try {
                            fs.unlinkSync( filename );
                        } catch( e ) {}
                    });
                    log.debug( "Uncompress error - " + err );
                    next("error", err);
                };
                readStream.on('error', rejectFunc);
                writeStream.on('error', rejectFunc);
                writeStream.on('finish', () => {
                    fs.chownSync( filename, file.uid, file.gid );
                    fs.utimesSync(filename, file.atime || new Date(), file.mtime || new Date());
                    next("finish");
                });
                if ( reportProgress ) {
                    readStream.pipe(reportProgress).pipe(writeStream);
                } else {
                    readStream.pipe(writeStream);
                }
            }
        } catch( e ) {
            log.error( "%s", e.stack );
            next("error", e);
        }
    };

    protected decodeString(buffer) {
        let result = null;
        try {
            result = jschardet.detect( buffer );
        } catch ( e ) {
            log.error( e );
        }
        let data = null;
        if ( result && result.encoding && [ "utf8", "ascii" ].indexOf(result.encoding) === -1 ) {
            if ( (global as any)?.LOCALE?.indexOf("ko-KR") > -1 ) {
                if ( result.confidence < 0.7 || result.encoding === "windows-1252") {
                    result.encoding = "EUC-KR";
                }
            }
            data = iconv.decode(buffer, result.encoding);
        } else {
            data = buffer.toString("utf8");
        }
        //log.info( "decode file: %s %s", result, data );
        return data;
    }
}




