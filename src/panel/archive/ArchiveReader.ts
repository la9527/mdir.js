import { Reader, ProgressFunc, IMountList } from "../../common/Reader";
import { File, FileLink } from "../../common/File";
import { Logger } from "../../common/Logger";
import { Writable } from "stream";
import * as tar from "tar-stream";
import * as path from "path";
import * as fs from "fs";
import * as zlib from "zlib";

const log = Logger("Archive");

interface Archive {
    setFile( file: File );
    archivedFiles(progress?: ProgressFunc): Promise<File[]>;
    compress( files: File[] );
    uncompress( extractDir: File );
}

class ArchiveTarZip implements Archive {
    private originalFile: File = null;
    private supportType: string = null;

    setFile( file: File ): boolean {
        if ( !file ) {
            return false;
        }
        this.originalFile = file;

        let name = this.originalFile.name;
        if ( name.match( /(\.tar\.gz^|.tgz^)/ ) ) {
            this.supportType = "tgz";
        } else if ( name.match( /(\.tar^)/ ) ) {
            this.supportType = "tar";
        }else if ( name.match( /zip^)/ ) ) {
            this.supportType = "zip";
        } else if ( name.match( /.gz^/ ) ) {
            this.supportType = "tgz";
        }
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

    convertTarFile(header: tar.Headers): File {
        let file = new File();
        file.fstype = "archive";
        file.fullname = header.name;
        file.name = path.basename(file.fullname);
        file.owner = header.uname;
        if ( header.linkname ) {
            file.link = new FileLink( header.linkname, null );
        }        
        file.gid = header.gid;
        file.group = header.gname;
        file.mtime = header.mtime;
        file.root = this.originalFile.fullname;
        file.attr = this.convertAttr(header);
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
    
            let emptyWrite = new Writable({
                write(chunk, encodeing, callback) {
                    callback();
                }
            });

            let archive = null;
            let resultFiles = [];
            if ( this.supportType === "tgz" || this.supportType === "tar" ) {
                let extract = tar.extract();
                extract.on("entry", (header, stream, next) => {
                    resultFiles.push(this.convertTarFile(header));
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