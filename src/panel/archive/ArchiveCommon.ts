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
    public abstract uncompress( extractDir: File, files ?: File[], progress?: ProgressFunc ): Promise<void>;

    public compress( sourceFile: File[], baseDir: File, targetDirOrNewFile: File, progress?: ProgressFunc ): Promise<void> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise( async (resolve, reject) => {
            let tmpWriteFileName = null;
            if ( targetDirOrNewFile.fstype === "file" ) {
                tmpWriteFileName = targetDirOrNewFile.fullname;

            } else if ( this.originalFile ) {
                this.originalFile.fullname + ".bak";
            }
            
            if ( !this.originalFile ) {
                this.supportType = this.isSupportType( targetDirOrNewFile );
            }
            const writeNewTarStream = fs.createWriteStream( tmpWriteFileName );
            try {
                await this.commonCompress( writeNewTarStream, async (pack) => {
                    if ( targetDirOrNewFile.fstype === "archive" ) {
                        await this.originalPacking(pack, null, progress);
                    }            
                    for ( const item of sourceFile ) {
                        let stream = null;
                        if ( !item.dir && !item.link ) {
                            stream = fs.createReadStream(item.fullname);
                        }
                        const targetDir = targetDirOrNewFile.fstype === "archive" ? targetDirOrNewFile.fullname : "";
                        const fileHeader = this.convertFileToHeader(item, baseDir, targetDir);
                        await this.packEntry(item, fileHeader, stream, pack);
                    }
                });
                if ( this.originalFile ) {
                    fs.unlinkSync( this.originalFile.fullname );
                    fs.renameSync( tmpWriteFileName, this.originalFile.fullname );
                }
                resolve();
            } catch( err ) {
                if ( fs.existsSync(tmpWriteFileName) ) {
                    fs.unlinkSync( tmpWriteFileName );
                }
                reject( err );
            }
        });
    }

    public rename( source: File, rename: string, progress?: ProgressFunc ): Promise<void> {
        rename = path.posix.normalize(rename);
        const filterEntryFunc = (tarFileInfo: File, header): boolean => {
            if ( !source.dir && source.fullname === tarFileInfo.fullname ) {
                header.name = rename.replace( /^\//, "" );
            } else if ( source.dir && tarFileInfo.fullname.indexOf(source.fullname) > -1 ) {
                header.name = tarFileInfo.fullname.replace( source.fullname, rename + path.posix.sep).replace( /^\//, "" );
            }
            return true;
        };
        // eslint-disable-next-line no-async-promise-executor
        return new Promise( async (resolve, reject) => {
            const tmpWriteFileName = this.originalFile.fullname + ".bak";
            const writeNewTarStream = fs.createWriteStream( tmpWriteFileName );
            try {
                await this.commonCompress( writeNewTarStream, async (pack) => {
                    await this.originalPacking( pack, filterEntryFunc, progress );
                });
                fs.unlinkSync( this.originalFile.fullname );
                fs.renameSync( tmpWriteFileName, this.originalFile.fullname );
                resolve();
            } catch( err ) {
                if ( fs.existsSync(tmpWriteFileName) ) {
                    fs.unlinkSync( tmpWriteFileName );
                }
                reject( err );
            }
        });
    }

    public remove( sourceFile: File[], progress?: ProgressFunc ): Promise<void> {
        const filterEntryFunc = (tarFileInfo: File, header): boolean => {
            if ( sourceFile.find( item => item.fullname == tarFileInfo.fullname ) ) {
                return false;
            }
            return true;
        };

        // eslint-disable-next-line no-async-promise-executor
        return new Promise( async (resolve, reject) => {
            const tmpWriteFileName = this.originalFile.fullname + ".bak";
            const writeNewTarStream = fs.createWriteStream( tmpWriteFileName );
            try {
                await this.commonCompress( writeNewTarStream, async (pack) => {
                    await this.originalPacking( pack, filterEntryFunc, progress );
                });
                fs.unlinkSync( this.originalFile.fullname );
                fs.renameSync( tmpWriteFileName, this.originalFile.fullname );
                resolve();
            } catch( err ) {
                if ( fs.existsSync(tmpWriteFileName) ) {
                    fs.unlinkSync( tmpWriteFileName );
                }
                reject( err );
            }
        });
    }

    protected abstract commonCompress( writeTarStream: fs.WriteStream, packFunc: (pack) => Promise<void>, progress?: ProgressFunc ): Promise<void>;
    protected abstract originalPacking( pack, filterEntryFunc: (packFileInfo: File, header) => boolean, progress?: ProgressFunc ): Promise<void>;
    protected abstract packEntry(file: File, header, stream: Readable, pack, reportProgress?: Transform): Promise<void>;
    protected abstract convertFileToHeader(file: File, srcBaseDir: File, targetDir: string): any;

    protected subDirectoryCheck(files: File[]): File[] {
        const dirFilter = files.filter( item => item.dir );
        const addFiles: File[] = [];

        files.forEach( item => {
            if ( item.fullname !== path.posix.sep && item.dirname !== path.posix.sep && addFiles.findIndex( (addItem) => addItem.fullname === item.dirname + "/" ) === -1 ) {
                if ( dirFilter.findIndex( (dirItem) => dirItem.fullname === item.dirname + path.posix.sep ) === -1 ) {
                    const file = item.clone();
                    file.fullname = item.dirname + path.posix.sep;
                    file.name = path.basename(item.dirname);
                    file.orgname = file.fullname.replace(/^\//, "");
                    file.attr = "drwxr-xr-x";
                    file.size = 0;
                    file.dir = true;
                    addFiles.push( file );
                }
            }
        });
        return files.concat( addFiles );
    }

    protected fileStreamWrite(extractDir: File, filesBaseDir: string, file: File, readStream: Readable, reportProgress: Transform, next: (status: string, err?:any) => void) {
        try {
            let filename = extractDir.fullname + ((filesBaseDir && filesBaseDir !== "/") ? file.fullname.substr(filesBaseDir.length) : file.fullname);
            filename = path.normalize( filename );
            const dirname = path.dirname(filename);
            const mode = convertAttrToStatMode(file);

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
                const writeStream = fs.createWriteStream(filename, { mode });
                const rejectFunc = (err) => {
                    readStream.destroy();
                    writeStream.end(() => {
                        try {
                            fs.unlinkSync( filename );
                        } catch( e ) {}
                    });
                    log.debug( "Uncompress error - " + err );
                    next("error", err);
                };
                readStream.on("error", rejectFunc);
                writeStream.on("error", rejectFunc);
                writeStream.on("finish", () => {
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
    }

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
