import { Reader, ProgressFunc, IMountList } from "../../common/Reader";
import { File, FileLink } from "../../common/File";
import { Logger } from "../../common/Logger";
import { Transform } from "stream";
import * as tar from "tar-stream";
import * as path from "path";
import * as fs from "fs";
import * as zlib from "zlib";
import * as yauzl from "yauzl";
import * as bunzip2 from "unbzip2-stream";
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

    decodeString(buffer) {
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

    convertZipToFile(zipHeader: yauzl.Entry): File {
        let file = new File();
        file.fstype = "archive";

        // console.log( zipHeader );

        const filename = this.decodeString(zipHeader.fileName);
        file.fullname = filename[0] !== "/" ? "/" + filename : filename;
        file.orgname = filename;
        file.name = path.basename(file.fullname);
        file.owner = "";
        file.group = "";
        file.uid = 0;
        file.gid = 0;
        if ( zipHeader.extraFields ) { // https://github.com/mhr3/unzip-stream/blob/master/lib/unzip-stream.js
            /**
             *          -Info-ZIP New Unix Extra Field:
                ====================================

                Currently stores Unix UIDs/GIDs up to 32 bits.
                (Last Revision 20080509)

                Value         Size        Description
                -----         ----        -----------
        (UnixN) 0x7875        Short       tag for this extra block type ("ux")
                TSize         Short       total data size for this block
                Version       1 byte      version of this extra field, currently 1
                UIDSize       1 byte      Size of UID field
                UID           Variable    UID for this entry
                GIDSize       1 byte      Size of GID field
                GID           Variable    GID for this entry
             */
            zipHeader.extraFields.map( item => {
                if ( item.id === 0x7875 ) { // Info-ZIP New Unix Extra Field
                    let offset = 0;
                    let extraVer = item.data.readInt8(0);
                    offset += 1;
                    if (extraVer === 1) {
                        let uidSize = item.data.readUInt8(offset);
                        offset += 1;
                        if (uidSize <= 6) {
                            file.uid = item.data.readUIntLE(offset, uidSize);
                        }
                        offset += uidSize;
    
                        let gidSize = item.data.readUInt8(offset);
                        offset += 1;
                        if (gidSize <= 6) {
                            file.gid = item.data.readUIntLE(offset, gidSize);
                        }
                    }
                }
            });
        }
        file.mtime = zipHeader.getLastModDate();
        file.ctime = zipHeader.getLastModDate();
        file.root = this.originalFile.fullname;
        file.attr = filename[filename.length - 1] === "/" ? "drwxr-xr-x" : "-rw-r--r--";
        file.size = zipHeader.uncompressedSize;
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
            if ( [ "tbz2", "tgz", "tar" ].indexOf( this.supportType ) > -1 ) {
                let file = this.originalFile;
                let stream: any = fs.createReadStream(file.fullname);
                let chunkSum = 0;

                const reportProgress = new Transform({
                    transform(chunk: Buffer, encoding, callback) {
                        chunkSum += chunk.length;
                        progress && progress( file, chunkSum, file.size, chunk.length );
                        log.debug( "Transform: %s => %d / %d", file.fullname, chunkSum, file.size );
                        callback( null, chunk );
                    }
                });

                stream = stream.pipe( reportProgress );

                let outstream: any = null;
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
                outstream.on("error", (error) => {
                    log.error( "ERROR", error );
                    reject(error);
                })
                .on("finish", () => {
                    log.info( "finish : [%d]", resultFiles.length );
                    resolve( resultFiles );
                });
            } else if ( this.supportType === "zip" ) {
                yauzl.open( this.originalFile.fullname, { lazyEntries: true, autoClose: false, decodeStrings: false }, (err, zipfile: yauzl.ZipFile) =>{
                    if ( err ) {
                        reject( err );
                        return;
                    }
                    zipfile.readEntry();
                    zipfile.on("entry", (entry: yauzl.Entry) => {
                        progress && progress( this.originalFile, entry.relativeOffsetOfLocalHeader, this.originalFile.size, this.originalFile.size - entry.relativeOffsetOfLocalHeader );
                        resultFiles.push( this.convertZipToFile(entry) );
                        zipfile.readEntry();
                    });
                    zipfile.once("end", () => {
                        progress && progress( this.originalFile, this.originalFile.size, this.originalFile.size, 0 );
                        zipfile.close();
                        resolve( resultFiles );
                    });
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
