import { Reader, ProgressFunc, IMountList } from "../../common/Reader";
import { File, FileLink } from "../../common/File";
import { Logger } from "../../common/Logger";
import { Writable, Transform } from "stream";
import * as tar from "tar-stream";
import * as path from "path";
import * as fs from "fs";
import * as zlib from "zlib";
import * as unzip from "unzip-stream";
import * as bunzip2 from "unbzip2-stream";
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
        } else if ( name.match( /(\.tar\.bz2$|\.tar\.bz$|\.tbz2$|\.tbz$)/ ) ) {
            this.supportType = "tbz2";
        } else if ( name.match( /(\.tar$)/ ) ) {
            this.supportType = "tar";
        }else if ( name.match( /\.zip$/ ) ) {
            this.supportType = "zip";
        } else if ( name.match( /\.gz$/ ) ) {
            this.supportType = "gz";
        } else if ( name.match( /.bz$/ )) {
            this.supportType = "bz2";
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
        file.fullname = header.name[0] !== "/" ? "/" + header.name : header.name;
        file.orgname = header.name;
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
        file.fullname = zipHeader.path[0] !== "/" ? "/" + zipHeader.path : zipHeader.path;
        file.orgname = zipHeader.path;
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

            let file = this.originalFile;
            let stream: any = fs.createReadStream(file.fullname);
            let chunkSum = 0;

            const reportProgress = new Transform({
                transform(chunk: Buffer, encoding, callback) {
                    chunkSum += chunk.length;
                    progress && progress( file, chunkSum, file.size, chunk.length );
                    // log.debug( "Transform: %s => %d / %d", file.fullname, chunkSum, file.size );
                    callback( null, chunk );
                }
            });

            stream = stream.pipe( reportProgress );

            let outstream: any = null;    
            let resultFiles = [];
            if ( [ "tbz2", "tgz", "tar" ].indexOf( this.supportType ) > -1 ) {
                let extract = tar.extract();
                extract.on("entry", (header, stream, next) => {
                    resultFiles.push(this.convertTarToFile(header));
                    stream.resume();
                    next();
                });
                
                if ( this.supportType === "tgz" ) {
                    outstream = stream.pipe(zlib.createGunzip());
                } else if ( this.supportType === "tbz2" ) {
                    outstream = stream.pipe(bunzip2());
                }
                outstream = outstream.pipe( extract );
            } else if ( this.supportType === "zip" ) {
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
                        // log.debug( "TRANSFORM: %s", e );
                        //log.debug( JSON.stringify(entry, null, 2) );
                        resultFiles.push(this.convertZipToFile(entry));
                        entry.autodrain();
                        cb();
                    }
                });
                outstream = stream.pipe(zipParse).pipe(transform);
            }
            outstream.on("error", (error) => {
                    log.error( "ERROR", error );
                    reject(error);
                })
                .on("finish", () => {
                    log.info( "finish : [%d]", resultFiles.length );
                    resolve( resultFiles );
                });
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
    private archiveObj: ArchiveTarZip = new ArchiveTarZip();
    private archiveFiles: File[] = [];
    private baseDir: File;

    async setArchiveFile( file: File, progressFunc: ProgressFunc ): Promise<boolean> {
        if ( !this.archiveObj.setFile( file ) ) {
            return false;
        }
        this.baseArchiveFile = file;
        this.archiveFiles = await this.archiveObj.archivedFiles(progressFunc);
        return true;
    }

    convertFile(path: string, option?: { fileInfo?: any; useThrow?: boolean; checkRealPath?: boolean; }): File {
        if ( !path ) {
            return null;
        }
        return this.archiveFiles.find( (item) => {
            return item.orgname === path;
        });
    }
    readdir(dir: File, option?: { isExcludeHiddenFile?: boolean; noChangeDir?: boolean; }): Promise<File[]> {
        let resultFile = this.archiveFiles.filter( (item) => {
            if ( item.orgname.indexOf( dir.orgname ) === 0 && 
                 item.orgname.split("/").length === dir.orgname.split("/").length ) {
                return true;
            }
            return false;
        });
        return new Promise((resolve) => {
            resolve( resultFile );
        });
    }
 
    homeDir(): File {
        return this.rootDir(); 
    }

    rootDir(): File {
        let file = new File();
        file.fstype = "archive";
        file.fullname = "/";
        file.orgname = "";
        file.name = "/";
        file.owner = "";
        file.group = "";
        file.uid = 0;
        file.gid = 0;
        file.mtime = new Date();
        file.root = this.baseArchiveFile.fullname;
        file.attr = "d---------";
        file.size = 0;
        return file;
    }

    mountList(): Promise<IMountList[]> {
        throw new Error("Method not implemented.");
    }

    changeDir(dirFile: File) {
        throw new Error("Method not implemented.");
    }

    currentDir(): File {
        return this.baseDir;
    }

    sep(): string {
        return "/";
    }

    exist(source: string | File): boolean {
        if ( !source ) {
            return false;
        }
        return !!this.archiveFiles.find( (item) => {
            if ( source instanceof File ) {
                return item.orgname === source.orgname;
            }
            return item.orgname === source;
        });
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