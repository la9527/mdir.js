import { Reader, ProgressFunc, IMountList } from "../../common/Reader";
import { File, FileLink } from "../../common/File";
import { Logger } from "../../common/Logger";
import { Writable, Transform } from "stream";
import * as tar from "tar-stream";
import * as path from "path";
import * as fs from "fs";
import * as zlib from "zlib";
import * as unzip from "unzip-stream";
import { transports } from "winston";
import * as jschardet from "jschardet";
import * as iconv from "iconv-lite";

const log = Logger("Archive");

interface Archive {
    setFile( file: File );
    archivedFiles(progress?: ProgressFunc): Promise<File[]>;
    compress( files: File[] );
    uncompress( extractDir: File );
}

export class ArchiveTarZip implements Archive {
    private originalFile: File = null;
    private supportType: string = null;

    setFile( file: File ): boolean {
        if ( !file ) {
            return false;
        }
        this.originalFile = file;

        let name = this.originalFile.name;
        log.debug( this.originalFile );
        if ( name.match( /(\.tar\.gz$|\.tgz$)/ ) ) {
            this.supportType = "tgz";
        } else if ( name.match( /(\.tar$)/ ) ) {
            this.supportType = "tar";
        }else if ( name.match( /\.zip$/ ) ) {
            this.supportType = "zip";
        } else if ( name.match( /\.gz$/ ) ) {
            this.supportType = "tgz";
        }
        log.debug( this.supportType );
        return !!this.supportType;
    }

    convertAttr( stats: tar.Headers ): string {
        const fileMode: string[] = "----------".split("");    
        fileMode[0] = stats.type === "block-device" ? "b" : fileMode[0];
        fileMode[0] = stats.type === "character-device" ? "c" : fileMode[0];
        fileMode[0] = stats.type === "fifo" ? "p" : fileMode[0];
        fileMode[0] = stats.type === "directory" ? "d" : fileMode[0];
        fileMode[0] = stats.type === "link" ? "l" : fileMode[0];
        
        fileMode[1] = stats.mode & fs.constants.S_IRUSR ? "r" : "-";
        fileMode[2] = stats.mode & fs.constants.S_IWUSR ? "w" : "-";
        fileMode[3] = stats.mode & fs.constants.S_IXUSR ? "x" : "-";
        fileMode[4] = stats.mode & fs.constants.S_IRGRP ? "r" : "-";
        fileMode[5] = stats.mode & fs.constants.S_IWGRP ? "w" : "-";
        fileMode[6] = stats.mode & fs.constants.S_IXGRP ? "x" : "-";
        fileMode[7] = stats.mode & fs.constants.S_IROTH ? "r" : "-";
        fileMode[8] = stats.mode & fs.constants.S_IWOTH ? "w" : "-";
        fileMode[9] = stats.mode & fs.constants.S_IXOTH ? "x" : "-";
        return fileMode.join("");
    };

    convertTarToFile(header: tar.Headers): File {
        let file = new File();
        file.fstype = "archive";
        file.fullname = header.name;
        file.name = path.basename(file.fullname);
        file.owner = header.uname;
        if ( header.linkname ) {
            file.link = new FileLink( header.linkname, null );
        }
        file.uid = header.uid;
        file.gid = header.gid;
        file.group = header.gname;
        file.mtime = header.mtime;
        file.root = this.originalFile.fullname;
        file.attr = this.convertAttr(header);
        file.size = header.size;
        return file;
    };

    convertZipToFile(zipHeader): File {
        let file = new File();
        file.fstype = "archive";
        file.fullname = zipHeader.path;
        file.name = path.basename(file.fullname);
        file.owner = "";
        file.group = "";
        file.uid = 0;
        file.gid = 0;
        file.mtime = new Date();
        file.root = this.originalFile.fullname;
        file.attr = zipHeader.isDirectory ? "d---------" : "----------";
        file.size = zipHeader.size;
        return file;
    };

    async archivedFiles(progress?: ProgressFunc): Promise<File[]> {
        return new Promise( (resolve, reject) => {
            if ( this.supportType === "gz" ) {
                let file = this.originalFile.clone();
                file.fstype = "archive";
                file.name = file.name.substr(file.name.length - 3);
                file.fullname = file.fullname.substr(file.fullname.length - 3);
                resolve( [file] );
                return;
            }
    
            let resultFiles = [];
            if ( this.supportType === "tgz" || this.supportType === "tar" ) {
                let extract = tar.extract();
                extract.on("entry", (header, stream, next) => {
                    resultFiles.push(this.convertTarToFile(header));
                    stream.resume();
                    next();
                });

                let stream = fs.createReadStream(this.originalFile.fullname);
                let outstream = null;
                if ( this.supportType === "tgz" ) {
                    outstream = stream.pipe(zlib.createGunzip()).pipe( extract );
                } else {
                    outstream = stream.pipe( extract );
                }
                outstream.on("error", (error) => {
                        log.error( "ERROR", error );
                        reject(error);
                    })
                    .on("finish", () => {
                        log.debug( resultFiles );
                        log.info( "finish : [%d]", resultFiles.length );
                        resolve( resultFiles );
                    });
            } else if ( this.supportType === "zip" ) {
                let stream = fs.createReadStream(this.originalFile.fullname);
                let zipParse = unzip.Parse({
                    decodeString: (buffer) => {
                        let result = null;
                        try {
                            result = jschardet.detect( buffer );
                        } catch ( e ) {
                            log.error( e );
                        }
                        let data = null;
                        if ( result && result.encoding && [ "utf8", "ascii" ].indexOf(result.encoding) === -1 ) {
                            data = iconv.decode(buffer, result.encoding);
                        } else {
                            data = buffer.toString("utf8");
                        }
                        // log.info( "decode file: %s %s", result, data );
                        return data;
                    }
                });

                let transform = new Transform({
                    objectMode: true,
                    transform: (entry,e,cb) => {
                        // log.debug( entry );
                        resultFiles.push(this.convertZipToFile(entry));
                        entry.autodrain();
                        cb();
                    }
                });

                stream.pipe(zipParse)
                    .pipe(transform)
                    .on("finish", () => {
                        log.debug( resultFiles );
                        log.info( "finish : [%d]", resultFiles.length );
                        resolve( resultFiles );
                    });
            }
        });
    }
    compress(files: File[], progress?: ProgressFunc) {
        throw new Error("Method not implemented.");
    }
    uncompress(extractDir: File, progress?: ProgressFunc) {
        throw new Error("Method not implemented.");
    }
}


export class ArchiveReader extends Reader {
    private baseArchiveFile: File;

    setArchiveFile( file: File ) {

    }

    convertFile(path: string, option?: { fileInfo?: any; useThrow?: boolean; checkRealPath?: boolean; }): File {
        throw new Error("Method not implemented.");
    }
    readdir(dir: File, option?: { isExcludeHiddenFile?: boolean; noChangeDir?: boolean; }): Promise<File[]> {
        throw new Error("Method not implemented.");
    }
    homeDir(): File {
        throw new Error("Method not implemented.");
    }
    rootDir(): File {
        throw new Error("Method not implemented.");
    }
    mountList(): Promise<IMountList[]> {
        throw new Error("Method not implemented.");
    }
    changeDir(dirFile: File) {
        throw new Error("Method not implemented.");
    }
    currentDir(): File {
        throw new Error("Method not implemented.");
    }
    sep(): string {
        throw new Error("Method not implemented.");
    }
    exist(source: string | File): boolean {
        throw new Error("Method not implemented.");
    }
    mkdir(path: string | File) {
        throw new Error("Method not implemented.");
    }
    rename(source: File, rename: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    copy(source: File, target: File, progress?: ProgressFunc): Promise<void> {
        throw new Error("Method not implemented.");
    }
    remove(source: File): Promise<void> {
        throw new Error("Method not implemented.");
    }    
}