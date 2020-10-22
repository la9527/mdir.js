/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-async-promise-executor */
import * as path from "path";
import * as fs from "fs";
import * as yazl from "yazl";
import * as yauzl from "yauzl";

import { ArchiveCommon } from "./ArchiveCommon";
import { File, FileLink } from "../../common/File";
import { ProgressFunc, ProgressResult } from "../../common/Reader";
import { Logger } from "../../common/Logger";
import { Transform, Readable } from "stream";

const log = Logger("archivetar");

export class ArchiveZip extends ArchiveCommon {
    isSupportType( file: File ): string {
        return file.name.match(/\.(zip|jar)$/) ? "zip" : null;
    }

    async getArchivedFiles(progress?: ProgressFunc): Promise<File[]> {
        return new Promise( (resolve, reject) => {
            const resultFiles = [];
            yauzl.open( this.originalFile.fullname, { lazyEntries: true, autoClose: false, decodeStrings: false }, (err, zipfile: yauzl.ZipFile) =>{
                if ( err ) {
                    reject( err );
                    return;
                }
                zipfile.on("entry", (entry: yauzl.Entry) => {
                    progress && progress( this.originalFile, (zipfile as any).readEntryCursor, this.originalFile.size, 0 );
                    resultFiles.push( this.convertZipToFile(entry) );
                    zipfile.readEntry();
                });
                zipfile.once("end", () => {
                    progress && progress( this.originalFile, this.originalFile.size, this.originalFile.size, 0 );
                    zipfile.close();
                    resolve( this.subDirectoryCheck(resultFiles) );
                });
                zipfile.readEntry();
            });
        });
    }

    uncompress( extractDir: File, uncompressFiles?: File[], progress?: ProgressFunc ): Promise<void> {
        return new Promise((resolve, reject) => {
            if ( !extractDir || (uncompressFiles && uncompressFiles.length === 0) ) {
                reject( "Uncompress files empty !!!" );
                return;
            }

            const filesBaseDir = uncompressFiles && uncompressFiles.length > 0 ? uncompressFiles[0].dirname : "";

            yauzl.open( this.originalFile.fullname, { lazyEntries: true, autoClose: false, decodeStrings: false }, (err, zipfile: yauzl.ZipFile) =>{
                if ( err ) {
                    reject( err );
                    return;
                }
                zipfile.on("entry", (entry: yauzl.Entry) => {
                    const zipFileInfo = this.convertZipToFile(entry);
                    if ( uncompressFiles ) {
                        if ( !uncompressFiles.find( item => zipFileInfo.fullname.startsWith(item.fullname) ) ) {
                            zipfile.readEntry();
                            return;
                        }
                    }

                    if ( zipFileInfo.dir || zipFileInfo.link ) {
                        this.fileStreamWrite( extractDir, filesBaseDir, zipFileInfo, null, null, (status: string, err) => {
                            // log.debug( "Uncompress: [%s] - [%s]", zipFileInfo.fullname, err || "SUCCESS" );
                            if ( err ) {
                                zipfile.close();
                                reject( err );
                                return;
                            }
                            zipfile.readEntry();
                        });
                        return;
                    }
                    zipfile.openReadStream( entry, (err, readStream) => {
                        if ( err ) {
                            // log.error( "zipfile.openReadStream: [%s]", err.message );
                            reject( err );
                            return;
                        }
                        
                        let chunkCopyLength = 0;
                        const reportProgress = new Transform({
                            transform(chunk: Buffer, encoding, callback) {
                                chunkCopyLength += chunk.length;
                                if ( progress ) {
                                    const result = progress( zipFileInfo, chunkCopyLength, zipFileInfo.size, chunk.length );
                                    // log.debug( "Uncompress: %s => %s (%d / %d)", zipFileInfo.fullname, extractDir.fullname, chunkCopyLength, zipFileInfo.size );
                                    if ( result === ProgressResult.USER_CANCELED ) {
                                        zipfile.close();
                                        log.debug( "ZIP Uncompress - CANCEL" );
                                        reject( "USER_CANCEL" );
                                        return;
                                    }
                                }
                                callback( null, chunk );
                            }
                        });
                        reportProgress._flush = (cb) => {
                            cb();
                            zipfile.readEntry();
                        };
                        
                        this.fileStreamWrite( extractDir, filesBaseDir, zipFileInfo, readStream, reportProgress, (status: string, err) => {
                            // log.debug( "Uncompress: [%s] - [%s]", zipFileInfo.fullname, err || "SUCCESS" );
                            if ( err ) {
                                zipfile.close();
                                reject( err );
                                return;
                            }
                        });
                    });
                });
                zipfile.on("error", (err) => {
                    log.error( err );
                    zipfile.close();
                    reject( err );
                });
                zipfile.once("end", () => {
                    zipfile.close();
                    resolve();
                });
                zipfile.readEntry();
            });
        });
    }

    protected commonCompress( writeTarStream: fs.WriteStream, packFunc: (zip: yazl.ZipFile) => Promise<void>, _progress?: ProgressFunc ): Promise<void> {
        const zip = new yazl.ZipFile();
        return new Promise( async (resolve, reject) => {
            try {
                writeTarStream.on("error", (error) => {
                    log.error( "ERROR [%s]", error );
                    reject(error);
                });                
                const outstream = zip.outputStream.pipe(writeTarStream);
                outstream.on("error", (error) => {
                    log.error( "ERROR [%s]", error );
                    reject(error);
                }).on("finish", () => {
                    writeTarStream.close();
                    log.info( "Compress Finish !!!" );
                    resolve();
                });                
                await packFunc( zip );
                (zip as any).end();
            } catch ( err ) {
                log.error( err );
                reject( err );
            }
        });
    }

    protected originalPacking( pack: yazl.ZipFile, filterEntryFunc: (packFileInfo: File, header) => boolean, progress?: ProgressFunc ): Promise<void> {
        return new Promise( (resolve, reject) => {
            yauzl.open( this.originalFile.fullname, { lazyEntries: true, autoClose: false, decodeStrings: false }, (err, zipfile: yauzl.ZipFile) =>{
                if ( err ) {
                    reject( err );
                    return;
                }
                zipfile.on("entry", (entry: yauzl.Entry) => {
                    try {
                        const zipFileInfo = this.convertZipToFile(entry);
                        const header = this.convertFileToHeader(zipFileInfo, null, null);

                        if ( filterEntryFunc && !filterEntryFunc( zipFileInfo, header ) ) {
                            zipfile.readEntry();
                            return;
                        }

                        if ( zipFileInfo.link ) {
                            reject( `Unsupport link file ${zipFileInfo.name}` );
                            return;
                        }
                        if ( zipFileInfo.dir ) {
                            pack.addEmptyDirectory( header.name, header.option );
                            zipfile.readEntry();
                            return;
                        }
                        zipfile.openReadStream( entry, (err, readStream) => {
                            if ( err ) {
                                log.error( "zipfile.openReadStream: [%s]", err.message );
                                reject( err );
                                return;
                            }
                            
                            let chunkCopyLength = 0;
                            const reportProgress = new Transform({
                                transform(chunk: Buffer, encoding, callback) {
                                    chunkCopyLength += chunk.length;
                                    if ( progress ) {
                                        const result = progress( zipFileInfo, chunkCopyLength, zipFileInfo.size, chunk.length );
                                        // log.debug( "Uncompress: %s => %d (%d / %d)", zipFileInfo.fullname, chunk.length, chunkCopyLength, zipFileInfo.size );
                                        if ( result === ProgressResult.USER_CANCELED ) {
                                            zipfile.close();
                                            log.debug( "ZIP Uncompress - CANCEL" );
                                            reject( "USER_CANCEL" );
                                            return;
                                        }
                                    }
                                    callback( null, chunk );
                                }
                            });
                            reportProgress._flush = (cb) => {
                                cb();
                                zipfile.readEntry();
                            };
                            readStream.on( "error", (err) => {
                                log.error( err );
                                reject( err );
                            });
                            pack.addReadStream( readStream.pipe(reportProgress), header.name, header.option );
                        });
                    } catch ( e ) {
                        log.error( e );
                        reject( e );
                    }
                });
                zipfile.on("error", (err) => {
                    log.error( err );
                    zipfile.close();
                    reject( err );
                });
                zipfile.once("end", () => {
                    zipfile.close();
                    resolve();
                });
                zipfile.readEntry();
            });
        });
    }

    protected packEntry(file: File, header, stream: Readable, pack: yazl.ZipFile, reportProgress?: Transform): Promise<void>  {
        return new Promise( (resolve, reject) => {
            if ( file.link ) {
                reject( `Unsupport link file - ${file.fullname}` );
                return;
            }
            if ( file.dir ) {
                pack.addEmptyDirectory( header.name, header.option );
                resolve();
            } else {
                stream.on( "error", (err) => {
                    log.error( err );
                    reject( err );
                });
                stream.on( "end", () => {
                    resolve();
                });
                if ( reportProgress ) {
                    stream = stream.pipe(reportProgress);
                }
                pack.addReadStream( stream, header.name, header.option );
            }
        });
    }

    protected convertFileToHeader( file: File, srcBaseDir: File, targetDir: string ) {
        const header: any = {
            name: file.orgname,
            option: {
                mtime: file.mtime,
                // mode: 0o100000 | convertAttrToStatMode(file)
            }
        };
        if ( file.fstype === "file" ) {
            let orgFilename = file.fullname.substr(srcBaseDir.fullname.length);
            orgFilename = orgFilename.split(path.sep).join(path.posix.sep);
            header.name = path.posix.normalize(targetDir + orgFilename).replace( /^\//, "");
        }
        return header;
    }

    private convertZipToFile(zipHeader: yauzl.Entry): File {
        const file = new File();
        file.fstype = "archive";

        const filename = this.decodeString(zipHeader.fileName);
        file.fullname = filename[0] !== "/" ? "/" + filename : filename;
        file.orgname = filename;
        file.name = path.basename(file.fullname);
        file.owner = "";
        file.group = "";
        file.uid = 0;
        file.gid = 0;
        file.mtime = zipHeader.getLastModDate();
        file.ctime = zipHeader.getLastModDate();
        file.root = this.originalFile.fullname;
        file.attr = filename[filename.length - 1] === "/" ? "drwxr-xr-x" : "-rw-r--r--";
        file.dir = file.attr[0] === "d";
        file.size = zipHeader.uncompressedSize;

        if ( zipHeader.extraFields ) {
            // .ZIP File Format Specification)
            //   - https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
            //   - https://opensource.apple.com/source/zip/zip-6/unzip/unzip/proginfo/extra.fld
            zipHeader.extraFields.map( item => {
                if ( item.id === 0x7875 ) { // Info-ZIP New Unix Extra Field
                    let offset = 0;
                    const extraVer = item.data.readInt8(0);
                    offset += 1;
                    if (extraVer === 1) {
                        const uidSize = item.data.readUInt8(offset);
                        offset += 1;
                        if (uidSize <= 6) {
                            file.uid = item.data.readUIntLE(offset, uidSize);
                        }
                        offset += uidSize;
    
                        const gidSize = item.data.readUInt8(offset);
                        offset += 1;
                        if (gidSize <= 6) {
                            file.gid = item.data.readUIntLE(offset, gidSize);
                        }
                    }
                } else if ( item.id === 0x5455 ) { // extended timestamp
                    let offset = 0;
                    const timestampFields = item.data.readInt8(0);
                    offset += 1;
                    if (item.data.byteLength >= 5 && timestampFields & 1) {
                        file.mtime = new Date(item.data.readUInt32LE(offset) * 1000);
                        offset += 4;
                    }
                    if (item.data.byteLength >= 9 && timestampFields & 2) {
                        file.atime = new Date(item.data.readUInt32LE(offset) * 1000);
                        offset += 4;
                    }
                    if (item.data.byteLength >= 13 && timestampFields & 4) {
                        file.ctime = new Date(item.data.readUInt32LE(offset) * 1000);
                    }
                } else if ( item.id === 0x5855 || item.id === 0x000d ) { // "Info-ZIP UNIX (type 1)", "PKWARE Unix"
                    let offset = 0;
                    if (item.data.byteLength >= 8) {
                        const atime = new Date(item.data.readUInt32LE(offset) * 1000);
                        offset += 4;
                        const mtime = new Date(item.data.readUInt32LE(offset) * 1000);
                        offset += 4;
                        file.atime = atime;
                        file.mtime = mtime;

                        if (item.data.byteLength >= 12) {
                            file.uid = item.data.readUInt16LE(offset);
                            offset += 2;
                            file.gid = item.data.readUInt16LE(offset);
                            offset += 2;
                        }
                    }
                } else if ( item.id === 0x7855 ) { // Info-ZIP Unix Extra Field (type 2)
                    let offset = 0;
                    if (item.data.byteLength >= 4) {
                        file.uid = item.data.readUInt16LE(offset);
                        offset += 2;
                        file.gid = item.data.readUInt16LE(offset);
                    }
                } else if ( item.id === 0x756e ) { // ASi Unix Extra Field
                    let offset = 0;
                    if (item.data.byteLength >= 14) {
                        // eslint-disable-next-line prefer-const
                        let crc = item.data.readUInt32LE(offset);
                        offset += 4;
                        const mode = item.data.readUInt16LE(offset);
                        offset += 2;
                        // eslint-disable-next-line prefer-const
                        let sizdev = item.data.readUInt32LE(offset);
                        offset += 4;
                        file.uid = item.data.readUInt16LE(offset);
                        offset += 2;
                        file.gid = item.data.readUInt16LE(offset);
                        offset += 2;
                        this.convertUnixPermission(file, mode);
                        if (item.data.byteLength > 14) {
                            const start = offset;
                            const end = item.data.byteLength - 14;
                            const symlinkName = this.decodeString(item.data.slice(start, end));
                            if ( symlinkName ) {
                                file.link = new FileLink( symlinkName, null );
                            }
                        }
                    }
                } else if ( item.id === 0x000a ) { // NTFS (Win9x/WinNT FileTimes)
                    let offset = 4;
                    if ( item.data.byteLength >= 24 + 4 + 4 ) {
                        // eslint-disable-next-line prefer-const
                        let tag1 = item.data.readUInt16LE(offset);
                        offset += 2;
                        // eslint-disable-next-line prefer-const
                        let size1 = item.data.readUInt16LE(offset);
                        offset += 2;
                        const mtime = item.data.readBigInt64LE(offset);
                        offset += 8;
                        const atime = item.data.readBigInt64LE(offset);
                        offset += 8;
                        const ctime = item.data.readBigInt64LE(offset);

                        try {
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            const EPOCH_OFFSET = -116444736000000000n;
                            const convertWin32Time = (time) => {
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                return new Date(Number((time + EPOCH_OFFSET) / 10000n));
                            };
                            file.mtime = convertWin32Time(mtime);
                            file.atime = convertWin32Time(atime);
                            file.ctime = convertWin32Time(ctime);
                        // eslint-disable-next-line no-empty
                        } catch( e ) {}
                    }
                }
            });
        }
        log.debug( "File [%s] - ORG [%s]", file.fullname, filename);
        return file;
    }

    private convertUnixPermission( file: File, mode: number ) {
        const fileMode: string[] = file.attr ? file.attr.split("") : "----------".split("");
        fileMode[1] = mode & fs.constants.S_IRUSR ? "r" : "-";
        fileMode[2] = mode & fs.constants.S_IWUSR ? "w" : "-";
        fileMode[3] = mode & fs.constants.S_IXUSR ? "x" : "-";
        fileMode[4] = mode & fs.constants.S_IRGRP ? "r" : "-";
        fileMode[5] = mode & fs.constants.S_IWGRP ? "w" : "-";
        fileMode[6] = mode & fs.constants.S_IXGRP ? "x" : "-";
        fileMode[7] = mode & fs.constants.S_IROTH ? "r" : "-";
        fileMode[8] = mode & fs.constants.S_IWOTH ? "w" : "-";
        fileMode[9] = mode & fs.constants.S_IXOTH ? "x" : "-";
        file.attr = fileMode.join("");
    }
}
