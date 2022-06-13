/* eslint-disable no-async-promise-executor */
import * as tar from "tar-stream";
import * as path from "path";
import * as fs from "fs";
import * as zlib from "zlib";
import * as bunzip2 from "unbzip2-stream";

import { ArchiveCommon } from "./ArchiveCommon.mjs";
import { File, FileLink } from "../../common/File.mjs";
import { ProgressFunc, ProgressResult } from "../../common/Reader.mjs";
import { Logger } from "../../common/Logger.mjs";
import { Transform, Readable } from "stream";
import { convertAttrToStatMode } from "../FileReader.mjs";

const log = Logger("archivetar");

export class ArchiveTarGz extends ArchiveCommon {
    protected isSupportType( file: File ): string {
        let supportType = null;
        const name = file.name;
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
        } else if ( name.match( /(\.tar\.xz$|\.txz$)/ )) {
            supportType = "txz";
        } else if ( name.match( /.xz$/ )) {
            supportType = "xz";
        }
        return supportType;
    }

    getArchivedFiles(progress?: ProgressFunc): Promise<File[]> {
        return new Promise( (resolve, reject) => {
            if ( this.supportType === "gz" || this.supportType === "xz" ) {
                const file = this.originalFile.clone();
                file.fstype = "archive";
                file.name = file.name.substr(file.name.length - 3);
                file.fullname = file.fullname.substr(file.fullname.length - 3);
                resolve( [file] );
                return;
            }

            let resultFiles = [];
            const file = this.originalFile;
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
            const extract = tar.extract();
            extract.on("entry", (header, stream, next) => {
                resultFiles.push(this.convertTarToFile(header));
                stream.resume();
                next();
            });

            stream.on("error", (error) => {
                log.error( error );
                reject(error);
            });
            
            if ( this.supportType === "tgz" ) {
                outstream = stream.pipe(zlib.createGunzip());
            } else if ( this.supportType === "tbz2" ) {
                outstream = stream.pipe(bunzip2());
            } else if ( this.supportType === "txz" ) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const lzma = require("lzma-native");
                    outstream = stream.pipe(lzma.createDecompressor());
                } catch( e ) {
                    reject( "unsupport xz file" );
                    return;
                }
            } else {
                outstream = stream;
            }
            outstream = outstream.pipe( extract );
            outstream.on("error", (error) => {
                log.error( error );
                reject(error);
            }).on("finish", () => {
                log.info( "finish : [%d]", resultFiles.length );
                resultFiles = this.subDirectoryCheck( resultFiles );
                log.info( "finish 2 : [%d]", resultFiles.length );
                resolve( resultFiles );
            });
        });
    }

    uncompress( extractDir: File, files?: File[], progress?: ProgressFunc ): Promise<void> {
        return new Promise((resolve, reject) => {
            const extractFiles = [];
            const file = this.originalFile;
            const tarStream: any = fs.createReadStream(file.fullname);
            const filesBaseDir = files && files.length > 0 ? files[0].dirname : "";

            let outstream: any = null;
            const extract = tar.extract();
            extract.on("entry", (header, stream, next: any) => {
                const tarFileInfo = this.convertTarToFile(header);
                if ( files ) {
                    if ( !files.find( item => tarFileInfo.fullname === item.fullname ) ) {
                        stream.resume();
                        next();
                        return;
                    }
                }

                let chunkSum = 0;
                const reportProgress = new Transform({
                    transform(chunk: Buffer, encoding, callback) {
                        chunkSum += chunk.length;
                        if ( progress ) {
                            const result = progress( tarFileInfo, chunkSum, tarFileInfo.size, chunk.length );
                            if ( result === ProgressResult.USER_CANCELED ) {
                                extract.destroy();
                                reject("USER_CANCEL");
                                return;
                            }
                        }
                        // log.debug( "Transform: %s => %d / %d", tarFileInfo.fullname, chunkSum, file.size );
                        callback( null, chunk );
                    }
                });
    
                this.fileStreamWrite( extractDir, filesBaseDir, tarFileInfo, stream, reportProgress, (status: string, err) => {
                    next(err);
                });
                extractFiles.push( tarFileInfo );
            });

            try {
                if ( this.supportType === "tgz" ) {
                    const gunzip = zlib.createGunzip();
                    gunzip.on("error", (error) => {
                        log.error( "ERROR [%s]", error );
                        extract.destroy();
                        reject(error);    
                    });
                    outstream = tarStream.pipe(gunzip);
                } else if ( this.supportType === "tbz2" ) {
                    outstream = tarStream.pipe(bunzip2());
                } else if ( this.supportType === "txz" ) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        const lzma = require("lzma-native");
                        outstream = tarStream.pipe(lzma.createDecompressor());
                    } catch( e ) {
                        log.error( "ERROR [%s]", e );
                        extract.destroy();
                        reject( e );
                        return;
                    }
                } else {
                    outstream = tarStream;
                }
                outstream = outstream.pipe( extract );
                outstream.on("error", (error) => {
                    log.error( "ERROR [%s]", error );
                    extract.destroy();
                    reject(error);
                }).on("finish", () => {
                    log.info( "finish : [%d]", extractFiles.length );
                    resolve();
                });
            } catch( err ) {
                log.error( "ERROR [%s]", err );
                extract.destroy();
                reject(err);
            }
        });
    }

    protected commonCompress( writeTarStream: fs.WriteStream, packFunc: (pack: tar.Pack) => Promise<void>, _progress?: ProgressFunc ): Promise<void> {
        const pack = tar.pack();
        return new Promise( async (resolve, reject) => {
            if ( this.supportType === "tbz2" ) {
                reject("Unsupport bzip2 compress !!!");
                return;
            }

            try {
                let outstream = null;
                writeTarStream.on("error", (error) => {
                    log.error( "ERROR [%s]", error );
                    pack.destroy();
                    reject(error);
                });
                if ( this.supportType === "tgz" ) {
                    const gzip = zlib.createGzip();
                    gzip.on("error", (error) => {
                        log.error( "ERROR [%s]", error );
                        pack.destroy(error);
                        writeTarStream.close();
                        reject(error);
                    });
                    outstream = pack.pipe(gzip).pipe(writeTarStream);
                } else if ( this.supportType === "txz" ) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        const lzma = require("lzma-native");
                        const xz = lzma.createCompressor();
                        xz.on("error", (error) => {
                            log.error( "ERROR [%s]", error );
                            pack.destroy(error);
                            writeTarStream.close();
                            reject(error);
                        });
                        outstream = pack.pipe(xz).pipe(writeTarStream);
                    } catch( e ) {
                        log.error( "ERROR [%s]", e );
                        reject( e );
                        return;
                    }
                } else {
                    outstream = pack.pipe(writeTarStream);
                }
                outstream.on("error", (error) => {
                    log.error( "ERROR [%s]", error );
                    pack.destroy();
                    writeTarStream.close();
                    reject(error);
                }).on("finish", () => {
                    log.info( "Compress Finish !!!" );
                    writeTarStream.close();
                    resolve();
                });

                await packFunc( pack );
                pack.finalize();
            } catch ( err ) {
                pack.destroy( err );
                reject( err );
            }
        });
    }

    protected originalPacking( pack: tar.Pack, filterEntryFunc: (tarFileInfo: File, header) => boolean, progress?: ProgressFunc ): Promise<void> {
        return new Promise( (resolve, reject) => {
            const tarStream: any = fs.createReadStream(this.originalFile.fullname);
            const extract = tar.extract();
            extract.on("entry", (header, stream, next: any) => {
                const tarFileInfo = this.convertTarToFile(header);

                if ( filterEntryFunc && !filterEntryFunc( tarFileInfo, header ) ) {
                    stream.on("end", function() {
                        next();
                    });
                    stream.resume();
                    return;
                }
                
                let chunkSum = 0;
                const reportProgress = new Transform({
                    transform(chunk: Buffer, encoding, callback) {
                        chunkSum += chunk.length;
                        if ( progress ) {
                            const result = progress( tarFileInfo, chunkSum, tarFileInfo.size, chunk.length );
                            if ( result === ProgressResult.USER_CANCELED ) {
                                extract.destroy();
                                reject("USER_CANCEL");
                                return;
                            }
                        }
                        // log.debug( "Transform: %s => %d / %d", tarFileInfo.fullname, chunkSum, file.size );
                        callback( null, chunk );
                    }
                });

                this.packEntry(tarFileInfo, header, stream, pack, reportProgress).then( () => {
                    next();
                }).catch( (error) => {
                    reject(error);
                });
            });
            
            let outstream = null;
            if ( this.supportType === "tgz" ) {
                outstream = tarStream.pipe(zlib.createGunzip());
            } else if ( this.supportType === "tbz2" ) {
                outstream = tarStream.pipe(bunzip2());
            } else if ( this.supportType === "txz" ) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const lzma = require("lzma-native");
                    outstream = tarStream.pipe(lzma.createDecompressor());
                } catch( e ) {
                    log.error( "ERROR [%s]", e );
                    extract.destroy();
                    reject( e );
                    return;
                }
            } else {
                outstream = tarStream;
            }
            outstream = outstream.pipe( extract );
            outstream.on("error", (error) => {
                log.error( "ERROR [%s]", error );
                extract.destroy();
                reject(error);
            }).on("finish", () => {
                log.info( "originalFileLoader finish !!" );
                resolve();
            });
        });
    }

    protected packEntry(file: File, header, stream: Readable, pack, reportProgress?: Transform): Promise<void> {
        return new Promise( (resolve, reject) => {
            if ( file.dir || file.link ) {
                log.debug( "Insert Directory : [%s] [%s]", file.fullname, header.name );
                pack.entry( header, (err) => err ? reject(err) : resolve());
            } else {
                const entry = pack.entry( header, (err) => {
                    log.debug( "Insert File : [%s] [%s]", file.fullname, header.name );
                    if ( err ) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
                stream.on( "error", (err) => {
                    entry.destroy(err);
                });
                if ( reportProgress ) {
                    stream.pipe(reportProgress).pipe( entry );
                } else {
                    stream.pipe( entry );
                }
            }
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
    }

    private convertTarToFile(header: tar.Headers): File {
        const file = new File();
        file.fstype = "archive";
        file.fullname = header.name[0] !== path.posix.sep ? path.posix.sep + header.name : header.name;
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
        file.dir = file.attr[0] === "d";
        return file;
    }

    protected convertFileToHeader(file: File, srcBaseDir: File, targetDir: string): tar.Headers {
        const header: tar.Headers = {
            name: file.orgname,
            mode: convertAttrToStatMode(file),
            mtime: file.mtime,
            size: file.size,
            type: file.dir ? "directory": "file",
            uid: file.uid,
            gid: file.gid
        };
        if ( file.fstype === "file" ) {
            let orgFilename = file.fullname.substr(srcBaseDir.fullname.length);
            orgFilename = orgFilename.split(path.sep).join(path.posix.sep);
            header.name = path.posix.normalize(targetDir + orgFilename).replace( /^\//, "");
        }
        if ( file.link ) {
            header.linkname = file.link.name;
            header.type = "symlink";
            header.size = 0;
        }
        return header;
    }
}
