import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as drivelist from "drivelist";

import { File, FileLink } from "../common/File";
import { Logger } from "../common/Logger";
import { Reader, IMountList, ProgressFunc, ProgressResult } from "../common/Reader";

import { ColorConfig } from "../config/ColorConfig";
import { Transform } from "stream";
import * as FileType from "file-type";

import fswin from "fswin";

const log = Logger("FileReader");

interface Win32Attributes {
    CREATION_TIME: Date,
    LAST_ACCESS_TIME: Date,
    LAST_WRITE_TIME: Date,
    SIZE: number,
    IS_ARCHIVED: boolean;
    IS_COMPRESSED: boolean;
    IS_DEVICE: boolean;
    IS_DIRECTORY: boolean;
    IS_ENCRYPTED: boolean;
    IS_HIDDEN: boolean;
    IS_NOT_CONTENT_INDEXED: boolean;
    IS_OFFLINE: boolean;
    IS_READ_ONLY: boolean;
    IS_SPARSE_FILE: boolean;
    IS_SYSTEM: boolean;
    IS_TEMPORARY: boolean;
    IS_INTEGRITY_STREAM: boolean;
    IS_NO_SCRUB_DATA: boolean;
    IS_REPARSE_POINT: boolean;
}

const convertAttr = ( stats: fs.Stats ): string => {
    const fileMode: string[] = "----------".split("");    
    fileMode[0] = stats.isSocket() ? "s" : fileMode[0];
    fileMode[0] = stats.isBlockDevice() ? "b" : fileMode[0];
    fileMode[0] = stats.isCharacterDevice() ? "c" : fileMode[0];
    fileMode[0] = stats.isFIFO() ? "p" : fileMode[0];
    fileMode[0] = stats.isDirectory() ? "d" : fileMode[0];
    fileMode[0] = stats.isSymbolicLink() ? "l" : fileMode[0];
    
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

export function convertAttrToStatMode( file: File ): number {
    if ( file instanceof File && file.attr && file.attr.length === 10 ) {
        let mode = 0;
        mode = mode | (file.attr[1] === 'r' ? fs.constants.S_IRUSR : 0);
        mode = mode | (file.attr[2] === 'w' ? fs.constants.S_IWUSR : 0);
        mode = mode | (file.attr[3] === 'x' ? fs.constants.S_IXUSR : 0);
        mode = mode | (file.attr[4] === 'r' ? fs.constants.S_IRGRP : 0);
        mode = mode | (file.attr[5] === 'w' ? fs.constants.S_IWGRP : 0);
        mode = mode | (file.attr[6] === 'x' ? fs.constants.S_IXGRP : 0);
        mode = mode | (file.attr[7] === 'r' ? fs.constants.S_IROTH : 0);
        mode = mode | (file.attr[8] === 'w' ? fs.constants.S_IWOTH : 0);
        mode = mode | (file.attr[9] === 'x' ? fs.constants.S_IXOTH : 0);
        return mode;
    }
    return 0;
}

const convertAttrFsDirect = ( dirent: fs.Dirent ): string => {
    const fileMode: string[] = os.platform() === "win32" ? "------".split("") : "----------".split("");
    fileMode[0] = dirent.isSymbolicLink() ? "l" : (dirent.isDirectory() ? "d" : "-");
    return fileMode.join("");
};

const convertAttrWin32 = ( stat: Win32Attributes ): string => {
    const fileMode: string[] = "------".split("");
    fileMode[0] = stat.IS_DIRECTORY ? "d" : "-";
    fileMode[1] = stat.IS_ARCHIVED ? "a" : "-";
    fileMode[2] = stat.IS_READ_ONLY ? "r" : "-";
    fileMode[3] = stat.IS_HIDDEN ? "h" : "-";
    fileMode[4] = stat.IS_SYSTEM ? "s" : "-";
    return fileMode.join("");
};

const PASSWD_FILE = "/etc/passwd";

interface ISystemUserInfo {
    name ?: string;
    uid ?: number;
    gid ?: number;
    fullname ?: string;
    homepath ?: string;
    sh ?: string;
}

export class SystemUserInfo {
    private _userInfo: ISystemUserInfo[] = [];

    constructor() {
        this.reload();
    }

    reload() {
        try {
            if ( fs.existsSync( PASSWD_FILE ) ) {
                let valueKeys = [ "name", "", "uid", "gid", "fullname", "homepath", "sh" ];
                
                // root:x:0:0:root:/root:/bin/bash
                const buffer = fs.readFileSync( PASSWD_FILE, "utf8" );
                let userInfos = [];
                buffer.split("\n").forEach( userInfoLine => {
                    if ( !userInfoLine.startsWith("#" ) ) {
                        const userInfoArr = userInfoLine.split(":");
                        let userInfo = {};
                        valueKeys.forEach( (key, i) => {
                            if ( key ) {
                                if ( [ "uid", "gid" ].indexOf(key) > -1 ) {
                                    userInfo[key] = parseInt(userInfoArr[i]);
                                } else {
                                    userInfo[key] = userInfoArr[i];
                                }
                            }
                        });
                        userInfos.push( userInfo );
                    }
                });
                this._userInfo = userInfos;
            }
        } catch( e ) {
            log.error( e );
            this._userInfo = [];
        }
    }

    findUid( uid: number, key: string = null ): ISystemUserInfo | string | number {
        const item = this._userInfo.find( (item) => item.uid === uid );
        return key ? (item && item[ key ]) : item;
    }

    findGid( gid: number, key: string = null ): ISystemUserInfo | string | number {
        const item = this._userInfo.find( (item) => item.gid === gid );
        return key ? (item && item[ key ]) : item;
    }
}

export class FileReader extends Reader {
    protected _readerFsType = "file";
    protected systemUserInfo = null;

    constructor() {
        super();
        this.systemUserInfo = new SystemUserInfo();
    }

    rootDir(): File {
        return this.convertFile( path.parse(fs.realpathSync(".")).root );
    }

    homeDir(): File {
        return this.convertFile( os.homedir() );
    }

    async mountList(): Promise<IMountList[]> {
        let mounts: IMountList[] = [];
        let drives = await drivelist.list();
        drives.forEach( item => {
            log.debug( "MOUNT INFO : %j", item );
            item.mountpoints.forEach( (i) => {
                mounts.push( {
                    device: item.device,
                    description: item.description,
                    mountPath: this.convertFile( i.path ),
                    size: item.size,
                    isCard: item.isCard,
                    isUSB: item.isUSB,
                    isRemovable: item.isRemovable,
                    isSystem: item.isSystem
                });
            });
        });
        return mounts;
    }

    static convertFile( filePath: string, option ?: { fileInfo ?: any, useThrow ?: boolean, checkRealPath ?: boolean } ): File {
        let fileReader = new FileReader();
        return fileReader.convertFile( filePath, option );
    }

    convertFile( filePath: string, option ?: { fileInfo ?: any, useThrow ?: boolean, checkRealPath ?: boolean, virtualFile ?: boolean } ): File {
        const { fileInfo, useThrow, checkRealPath } = option || {};
        const file = new File();
        file.fstype = this._readerFsType;

        try {
            if ( filePath === "~" || filePath[0] === "~" ) {
                file.fullname = os.homedir() + filePath.substr(1);
            } else if ( filePath === ".." || filePath === "." ) {
                file.fullname = fs.realpathSync( filePath );
            } else {
                file.fullname = checkRealPath ? fs.realpathSync(filePath) : filePath;
            }
            const pathInfo = path.parse( file.fullname );
            file.root = pathInfo.root;
            file.name = pathInfo.base || pathInfo.root;
        } catch( e ) {
            log.error( "convertfile - FAIL : [%s] %j", filePath, e);
            if ( useThrow ) {
                throw e;
            }
            return null;
        }
        
        if ( option && option.virtualFile ) {
            file.dir = false;
            file.uid = -1;
            file.gid = -1;
            file.ctime = new Date(0);
            file.mtime = new Date(0);
            file.atime = new Date(0);
            return file;
        }

        try {
            if ( process.platform === "win32" ) {
                const item: Win32Attributes = fswin.getAttributesSync(file.fullname);
                // log.debug( "%s, %j", fullPathname, JSON.stringify( item ) );
                file.attr = convertAttrWin32( item );
                file.dir = item.IS_DIRECTORY;
                file.size = item.SIZE;
                file.ctime = item.CREATION_TIME;
                file.mtime = item.LAST_WRITE_TIME;
                file.atime = item.LAST_ACCESS_TIME;
            } else {
                const stat = fs.lstatSync( file.fullname );
                file.dir = stat.isDirectory();
                file.size = stat.size;
                file.attr = convertAttr( stat );
                file.uid = stat.uid;
                file.gid = stat.gid;
                file.owner = this.systemUserInfo.findUid(stat.uid, "name");
                file.group = this.systemUserInfo.findGid(stat.gid, "name");
                file.ctime = stat.ctime;
                file.mtime = stat.mtime;
                file.atime = stat.atime;
            }
        } catch ( e ) {
            log.error( "convertfile - FAIL 2 : [%s] %j", filePath, e);
            if ( fileInfo ) {
                file.dir = fileInfo.isDirectory();
                file.attr = convertAttrFsDirect( fileInfo );
                file.uid = -1;
                file.gid = -1;
                file.ctime = new Date(0);
                file.mtime = new Date(0);
                file.atime = new Date(0);
            } else {
                if ( useThrow ) {
                    throw e;
                }
                return null;
            }
        }

        if ( (file.attr && file.attr[0] === "l") || (fileInfo && fileInfo.isSymbolicLink()) ) {
            try {
                const linkOrgName = fs.readlinkSync( file.fullname );
                file.link = new FileLink( path.basename( linkOrgName ) );

                const linkStat = fs.lstatSync( linkOrgName );
                if ( linkStat && !linkStat.isSymbolicLink() ) {
                    file.link.file = this.convertFile( linkOrgName );
                }
            } catch ( e ) {
                log.error( "convertfile - FAIL 3 : [%s] %j", filePath, e);
            }
        }
        return file;
    }

    changeDir( dirFile: File ) {
        if ( dirFile && dirFile.fullname ) {
            process.chdir( dirFile.fullname );
        }
    }

    currentDir(): File {
        return this.convertFile(process.cwd());
    }

    readdir( dirFile: File, option ?: { isExcludeHiddenFile ?: boolean, noChangeDir ?: boolean } ): Promise<File[]> {
        return new Promise<File[]>( (resolve, reject ) => {
            if ( !dirFile.dir ) {
                reject(`Not directory. ${dirFile.name}`);
                return;
            }

            const fileItem: File[] = [];
            try {
                if ( !(option && option.noChangeDir) ) {
                    process.chdir(dirFile.fullname);
                }

                const fileList: fs.Dirent[] = (fs as any).readdirSync( dirFile.fullname, { encoding: "utf8", withFileTypes: true  } );
                log.info( "READDIR: PATH: [%s], FILES: %j", dirFile.fullname, fileList );
                for ( let file of fileList ) {
                    let dirPath = dirFile.fullname;
                    if ( dirPath.substr(dirPath.length - 1, 1) !== path.sep) {
                        dirPath += path.sep;
                    }

                    const item = this.convertFile(dirPath + file.name, { fileInfo: file } );
                    //log.info( "dirInfo [%s][%s][%s]", dirPath, file.name, item.fullname );
                    if ( option && option.isExcludeHiddenFile ) {
                        if ( process.platform !== "win32" && item.name !== ".." && item.name[0] === "." ) {
                            continue;
                        }
                    }
                    if ( item ) {
                        fileItem.push( item );
                    }
                }
            } catch ( e ) {
                log.error( "READDIR () - ERROR %j", e );
                reject(e);
                return;
            }

            /*
            this.fileTypeUpdate(fileItem).finally( () => {
                resolve( fileItem );
            });
            */
            resolve( fileItem );
        });
    }

    async fileTypeUpdate( fileItem: File[] ) {
        for ( let item of fileItem ) {
            if ( !item.dir && !item.link ) {
                try {
                    const fileType = await FileType.fromFile( item.fullname );
                    if ( fileType ) {
                        item.mimetype = fileType.mime;
                    }
                } catch( e ) {
                    log.debug( e );
                }
            }
        }
    }

    sep() {
        return path.sep;
    }

    exist( source: File | string ) {
        if ( source instanceof File ) {
            return fs.existsSync( source.fullname );
        }
        return fs.existsSync( source );
    }

    mkdir( path: string | File ) {
        if ( path instanceof File ) {
            if ( !path.dir ) {
                return;
            }
            fs.mkdirSync( path.fullname, { mode: convertAttrToStatMode(path) } );
        } else {
            fs.mkdirSync( path );
        }
    }
    
    rename( source: File, rename: string ): Promise<void> {
        return new Promise( (resolve, reject) => {
            fs.rename( source.fullname, rename, (err) => {
                if ( err ) {
                    reject( err );
                } else {
                    resolve();
                }
            });
        });
    }

    copy( source: File, target: File, progress: ProgressFunc = null ): Promise<void> {
        let reader = this;
        return new Promise( ( resolve, reject ) => {
            let srcFile = source.link ? source.link.file : source;
            if ( srcFile.dir || target.dir ) {
                reject("Unable to copy from a source directory.");
                return;
            }

            if ( srcFile.dirname === target.fullname ) {
                log.debug( "source file and target file are the same." );
                resolve();
                return;
            }

            let chunkCopyLength = 0;
            let rd = fs.createReadStream(srcFile.fullname);
            let wr = fs.createWriteStream(target.fullname);

            let rejectFunc = (err) => {
                rd.destroy();
                wr.end(() => {
                    fs.unlinkSync( target.fullname );
                });
                log.debug( "COPY ERROR - " + err );
                reject(err);
            };

            rd.on('error', rejectFunc);
            wr.on('error', rejectFunc);
            wr.on('finish', () => {
                resolve();
            });

            const reportProgress = new Transform({
                transform(chunk: Buffer, encoding, callback) {
                    chunkCopyLength += chunk.length;
                    const result = progress && progress( srcFile, chunkCopyLength, srcFile.size, chunk.length );
                    log.debug( "Copy to: %s => %s (%d / %d)", srcFile.fullname, target.fullname, chunkCopyLength, srcFile.size );
                    if ( result === ProgressResult.USER_CANCELED ) {
                        rd.destroy();
                        wr.end(() => {
                            fs.unlinkSync( target.fullname );
                        });
                        log.debug( "COPY - CANCEL" );
                        reject( "USER_CANCEL" );
                        return;
                    }
                    callback( null, chunk );
                }
            });
            rd.pipe( reportProgress ).pipe(wr);
        });
    }

    remove( source: File ): Promise<void> {
        return new Promise( (resolve, reject) => {
            if ( source.dir ) {
                fs.rmdir( source.fullname, (err) => {
                    if ( err ) {
                        reject( err );
                    } else {
                        resolve();
                    }
                });
            } else {
                fs.unlink( source.fullname, (err) => {
                    if ( err ) {
                        reject( err );
                    } else {
                        resolve();
                    }
                });
            }
        });
    }

    createFile( fullname: string, option ?: { virtualFile ?: boolean } ): File {
        if ( !(option && option.virtualFile) ) {
            fs.writeFileSync( fullname, "", { mode: 0o644 } );
            return this.convertFile( fullname, { checkRealPath: true } );
        }
        return this.convertFile( fullname, { virtualFile: true } );
    }

    static createFile( fullname: string, option ?: { virtualFile ?: boolean } ): File {
        let fileReader = new FileReader();
        return fileReader.createFile( fullname );
    }
}
