import * as jschardet from "jschardet";
import * as iconv from "iconv-lite";
import * as path from "path";
import * as fs from "fs";

import { ProgressFunc } from "../../common/Reader";
import { File } from "../../common/File";
import { Logger } from "../../common/Logger";
import { Readable, Transform } from "stream";
import { convertAttrToStatMode } from "../FileReader";

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

    public abstract compress( sourceFile: File[], baseDir: File, targetDirOrNewFile ?: File, progress?: ProgressFunc ): Promise<void>;
    public abstract uncompress( extractDir: File, files ?: File[], progress?: ProgressFunc ): Promise<void>;

    public abstract rename( source: File, rename: string, progress?: ProgressFunc ): Promise<void>;
    public abstract remove( sourceFile: File[], progress?: ProgressFunc ): Promise<void>;

    protected checkEmptyDirectory( orgFiles: File[] ): File[] {
        let files = orgFiles;
        let checkDir = (dir: string) => {
            return files.find(item => {
                if ( item.dir && path.format(path.parse(item.fullname)) === dir ) {
                    return true;
                }
                return false;
            });
        };

        let i = 0;
        for( ;; ) {
            if ( i >= files.length ) {
                break;
            }
            if ( !files[i].dir && files[i].dirname !== "/" && !checkDir( files[i].dirname ) ) {
                let file = files[i].clone();
                file.fullname = files[i].dirname + "/";
                file.name = path.basename(files[i].dirname);
                file.orgname = "";
                file.attr = "drwxr-xr-x";
                file.size = 0;
                file.dir = true;
                files.splice( i, 0, file );
            }
            i++;
        }
        return files;
    }

    protected fileStreamWrite(extractDir: File, filesBaseDir: string, file: File, readStream: Readable, reportProgress: Transform, next: (status: string, err?:any) => void) {
        try {
            let filename = extractDir.fullname + ((filesBaseDir && filesBaseDir !== "/") ? file.fullname.substr(filesBaseDir.length) : file.fullname);
            filename = path.normalize( filename );
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
                try {
                    fs.chownSync( filename, file.uid, file.gid );
                } catch( e ) {
                    console.error( e.message );
                }
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
                    try {
                        fs.chownSync( filename, file.uid, file.gid );
                    } catch( e ) {
                        log.error( e.message );
                    }
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




