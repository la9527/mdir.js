import * as path from "path";
import * as fs from "fs";
import * as yauzl from "yauzl";

import { ArchiveCommon } from "./ArchiveCommon";
import { File, FileLink } from "../../common/File";
import { Reader, ProgressFunc, IMountList, ProgressResult } from "../../common/Reader";
import { Logger } from "../../common/Logger";
import { Transform, TransformCallback } from "stream";
import { convertAttrToStatMode } from "../FileReader";

const log = Logger("archivetar");

export class ArchiveZip extends ArchiveCommon {
    isSupportType( file: File ): string {
        return this.originalFile.name.match(/(\.zip$)/) ? "zip" : null;
    }

    async getArchivedFiles(progress?: ProgressFunc): Promise<File[]> {
        return new Promise( (resolve, reject) => {
            let resultFiles = [];
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

    compress( files: File[], progress?: ProgressFunc ): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    uncompress( extractDir: File, uncompressFiles ?: File[], progress?: ProgressFunc ): Promise<void> {
        return new Promise((resolve, reject) => {
            if ( !extractDir || (uncompressFiles && uncompressFiles.length === 0) ) {
                reject( "Uncompress files empty !!!" );
                return;
            }

            let filesBaseDir = uncompressFiles && uncompressFiles.length > 0 ? uncompressFiles[0].dirname : "";

            yauzl.open( this.originalFile.fullname, { lazyEntries: true, autoClose: false, decodeStrings: false }, (err, zipfile: yauzl.ZipFile) =>{
                if ( err ) {
                    reject( err );
                    return;
                }
                zipfile.on("entry", (entry: yauzl.Entry) => {
                    let zipFileInfo = this.convertZipToFile(entry);
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
                                    let result = progress( zipFileInfo, chunkCopyLength, zipFileInfo.size, chunk.length );
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

    private subDirectoryCheck(files: File[]): File[] {
        let dirFilter = files.filter( item => item.dir );
        let addFiles: File[] = [];
        
        files.forEach( item => {
            if ( item.fullname !== "/" && item.dirname !== "/" && addFiles.findIndex( (addItem) => addItem.fullname === item.dirname + "/" ) === -1 ) {
                if ( dirFilter.findIndex( (dirItem) => dirItem.fullname === item.dirname + "/" ) === -1 ) {                
                    addFiles.push( this.convertDirectory( item.dirname + "/" ) );
                }
            }
        });
        return files.concat( addFiles );
    }

    private convertDirectory(filename: string): File {
        let file = new File;
        file.fstype = "archive";
        file.fullname = filename[0] !== "/" ? "/" + filename : filename;
        file.orgname = filename;
        file.name = path.basename(file.fullname);
        file.owner = "";
        file.group = "";
        file.uid = 0;
        file.gid = 0;
        file.mtime = new Date();
        file.ctime = new Date();
        file.root = this.originalFile.fullname;
        file.attr = "drwxr-xr-x";
        file.dir = true;
        file.size = 0;
        return file;
    }

    private convertZipToFile(zipHeader: yauzl.Entry): File {
        let file = new File();
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
        file.dir = file.attr[0] === 'd';
        file.size = zipHeader.uncompressedSize;

        if ( zipHeader.extraFields ) {
            // .ZIP File Format Specification)
            //   - https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
            //   - https://opensource.apple.com/source/zip/zip-6/unzip/unzip/proginfo/extra.fld
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
                } else if ( item.id === 0x5455 ) { // extended timestamp
                    let offset = 0;
                    let timestampFields = item.data.readInt8(0);
                    offset += 1;
                    if (timestampFields & 1) {
                        file.mtime = new Date(item.data.readUInt32LE(offset) * 1000);
                        offset += 4;
                    }
                    if (timestampFields & 2) {
                        file.atime = new Date(item.data.readUInt32LE(offset) * 1000);
                        offset += 4;
                    }
                    if (timestampFields & 4) {
                        file.ctime = new Date(item.data.readUInt32LE(offset) * 1000);
                    }
                } else if ( item.id === 0x5855 || item.id === 0x000d ) { // "Info-ZIP UNIX (type 1)", "PKWARE Unix"
                    let offset = 0;
                    if (item.data.byteLength >= 8) {
                        let atime = new Date(item.data.readUInt32LE(offset) * 1000);
                        offset += 4;
                        let mtime = new Date(item.data.readUInt32LE(offset) * 1000);
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
                        let crc = item.data.readUInt32LE(offset);
                        offset += 4;
                        let mode = item.data.readUInt16LE(offset);
                        offset += 2;
                        let sizdev = item.data.readUInt32LE(offset);
                        offset += 4;
                        file.uid = item.data.readUInt16LE(offset);
                        offset += 2;
                        file.gid = item.data.readUInt16LE(offset);
                        offset += 2;
                        this.convertUnixPermission(file, mode);
                        if (item.data.byteLength > 14) {
                            let start = offset;
                            let end = item.data.byteLength - 14;
                            let symlinkName = this.decodeString(item.data.slice(start, end));
                            if ( symlinkName ) {
                                file.link = new FileLink( symlinkName, null );
                            }
                        }
                    }
                } else if ( item.id === 0x000a ) { // NTFS (Win9x/WinNT FileTimes)
                    let offset = 4;
                    if ( item.data.byteLength >= 24 + 4 + 4 ) {
                        let tag1 = item.data.readUInt16LE(offset);
                        offset += 2;
                        let size1 = item.data.readUInt16LE(offset);
                        offset += 2;
                        let mtime = item.data.readBigInt64LE(offset);
                        offset += 8;
                        let atime = item.data.readBigInt64LE(offset);
                        offset += 8;
                        let ctime = item.data.readBigInt64LE(offset);

                        try {
                            // @ts-ignore
                            let EPOCH_OFFSET = -116444736000000000n;
                            const convertWin32Time = (time) => {
                                // @ts-ignore
                                return new Date(Number((time + EPOCH_OFFSET) / 10000n))
                            };
                            file.mtime = convertWin32Time(mtime);
                            file.atime = convertWin32Time(atime);
                            file.ctime = convertWin32Time(ctime);
                        } catch( e ) {}
                    }
                }
            });
        }
        return file;
    };

    private convertUnixPermission( file: File, mode: number ) {
        let fileMode: string[] = file.attr ? file.attr.split("") : "----------".split("");
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
