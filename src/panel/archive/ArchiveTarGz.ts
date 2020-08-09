import * as tar from "tar-stream";
import * as path from "path";
import * as fs from "fs";
import * as zlib from "zlib";
import * as yauzl from "yauzl";
import * as bunzip2 from "unbzip2-stream";

import { ArchiveCommon } from "./ArchiveCommon";
import { File, FileLink } from "../../common/File";
import { Reader, ProgressFunc, IMountList } from "../../common/Reader";
import { Logger } from "../../common/Logger";
import { Transform } from "stream";

const log = Logger("archivetar");

export class ArchiveTarGz extends ArchiveCommon {
    protected isSupportType( file: File ): string {
        let supportType = null;
        let name = this.originalFile.name;
        if ( name.match( /(\.tar\.gz$|\.tgz$)/ ) ) {
            supportType = "tgz";
        } else if ( name.match( /(\.tar\.bz2$|\.tar\.bz$|\.tbz2$|\.tbz$)/ ) ) {
            supportType = "tbz2";
        } else if ( name.match( /(\.tar$)/ ) ) {
            supportType = "tar";
        } else if ( name.match( /\.gz$/ ) ) {
            supportType = "gz";
        } else if ( name.match( /.bz$/ )) {
            supportType = "bz2";
        }
        return supportType;
    }

    getArchivedFiles(progress?: ProgressFunc): Promise<File[]> {
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
        });
    }

    private convertAttr( stats: tar.Headers ): string {
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

    private convertTarToFile(header: tar.Headers): File {
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
        file.dir = file.attr[0] === 'd';
        return file;
    };
}
