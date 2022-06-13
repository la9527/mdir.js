import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

import { File, FileLink } from "../common/File.mjs";
import { Logger } from "../common/Logger.mjs";
import { Reader, IMountList, ProgressFunc, ProgressResult } from "../common/Reader.mjs";

import { Transform } from "stream";
import FileType from "file-type";
import jschardet from "jschardet";
import iconv from "iconv-lite";

import fswin from "fswin";

const log = Logger("FileReader");

interface Win32Attributes {
    CREATION_TIME: Date;
    LAST_ACCESS_TIME: Date;
    LAST_WRITE_TIME: Date;
    SIZE: number;
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
    
    fileMode[1] = stats.mode & 256 ? "r" : "-";
    fileMode[2] = stats.mode & 128 ? "w" : "-";
    fileMode[3] = stats.mode & 64 ? "x" : "-";
    fileMode[4] = stats.mode & 32 ? "r" : "-";
    fileMode[5] = stats.mode & 16 ? "w" : "-";
    fileMode[6] = stats.mode & 8 ? "x" : "-";
    fileMode[7] = stats.mode & 4 ? "r" : "-";
    fileMode[8] = stats.mode & 2 ? "w" : "-";
    fileMode[9] = stats.mode & 1 ? "x" : "-";
    return fileMode.join("");
};

export function convertAttrToStatMode( file: File ): number {
    if ( file instanceof File && file.attr && file.attr.length === 10 ) {
        let mode = 0;
        mode = mode | (file.attr[1] === "r" ? 256 : 0);
        mode = mode | (file.attr[2] === "w" ? 128 : 0);
        mode = mode | (file.attr[3] === "x" ? 64 : 0);
        mode = mode | (file.attr[4] === "r" ? 32 : 0);
        mode = mode | (file.attr[5] === "w" ? 16 : 0);
        mode = mode | (file.attr[6] === "x" ? 8 : 0);
        mode = mode | (file.attr[7] === "r" ? 4 : 0);
        mode = mode | (file.attr[8] === "w" ? 2 : 0);
        mode = mode | (file.attr[9] === "x" ? 1 : 0);
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
    name?: string;
    uid?: number;
    gid?: number;
    fullname?: string;
    homepath?: string;
    sh?: string;
}

export class SystemUserInfo {
    private _userInfo: ISystemUserInfo[] = [];

    constructor() {
        this.reload();
    }

    reload() {
        try {
            if ( fs.existsSync( PASSWD_FILE ) ) {
                const valueKeys = [ "name", "", "uid", "gid", "fullname", "homepath", "sh" ];
                
                // root:x:0:0:root:/root:/bin/bash
                const buffer = fs.readFileSync( PASSWD_FILE, "utf8" );
                const userInfos = [];
                buffer.split("\n").forEach( userInfoLine => {
                    if ( !userInfoLine.startsWith("#" ) ) {
                        const userInfoArr = userInfoLine.split(":");
                        const userInfo = {};
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
    protected watcher = null;
    protected _isNotChangeDir = false;
    protected _curDir: File = null;
    
    constructor() {
        super();
        this.systemUserInfo = new SystemUserInfo();
    }

    async init(option: { isNotChangeDir?: boolean; defaultHomePath?: string } = null) {
        this._isNotChangeDir = option?.isNotChangeDir || false;
        this._curDir = await this.convertFile( option?.defaultHomePath || os.homedir(), { checkRealPath: true });
    }

    destory() {
        if ( this.watcher ) {
            this.watcher.close();
            this.watcher = null;
        }
    }

    async rootDir(): Promise<File> {
        return await this.convertFile( path.parse(fs.realpathSync(".")).root );
    }

    async homeDir(): Promise<File> {
        return await this.convertFile( os.homedir() );
    }

    async mountListWin10(): Promise<IMountList[]> {
        const mounts: IMountList[] = [];
        const convertBufferCode = ( bufferData: Buffer ): string => {
            let result = null;
            try {
                result = jschardet.detect( bufferData );
            } catch ( e ) {
                log.error( e );
            }
            log.info( "jschardet: %j", result );
            try {
                let data = null;
                if ( result && result.encoding ) {
                    if ( [ "utf8", "ascii" ].indexOf(result.encoding) > -1 ) {
                        data = bufferData.toString("utf8");
                    } else {
                        data = iconv.decode(bufferData, result.encoding);
                    }
                }
                return data;
            } catch( e ) {
                log.error( e );
            }
            return null;
        };
        const result: Buffer = execSync("wmic logicaldisk get deviceid, volumename, description, drivetype, freespace, size /VALUE");
        if ( !result ) {
            return mounts;
        }
        const convertInfo = convertBufferCode(result);
        if ( !convertInfo ) {
            return mounts;
        }
        const texts = convertInfo.split("\r\r\n");
        const mountInfo = [];
        let device = null;
        for ( const item of texts ) {
            if ( !item && device ) {
                mountInfo.push( device );
                device = null;
            } else {
                const text: string[] = item.split("=");
                if ( text[0] ) {
                    device = device || {};
                    device[ text[0] ] = text.slice(1).join("=");
                }
            }
        }

        for ( const item of mountInfo ) {
            log.debug( "%s", item );
            const mountFile = await this.convertFile( item.DeviceID + path.sep, { useThrow: false, checkRealPath: true } );
            if ( mountFile ) {
                mounts.push( {
                    device: item.VolumeName,
                    description: item.Description,
                    mountPath: mountFile,
                    freesize: parseInt(item.FreeSpace || 0),
                    size: parseInt(item.Size || 0),
                    isCard: item.DriveType === "5",
                    isUSB: item.DriveType === "2",
                    isRemovable: item.DriveType === "2",
                    isSystem: item.DriveType === "3"
                });
            }
        }
        return mounts;
    }

    async mountListMac(): Promise<IMountList[]> {
        const mounts: IMountList[] = [];
        const result = execSync("mount", { encoding: "utf8" });
        if ( !result ) {
            return mounts;
        }

        const items = result.split("\n");
        for ( const item of items ) {
            const result = item.match( /(.*) on (.*) \((.*)\)/i );
            if ( !result || result.length !== 4 ) {
                continue;
            }
            if ( result[3].match( "nobrowse" ) ) {
                continue;
            }

            const mountFile = await this.convertFile( result[2] );
            mounts.push({
                device: result[1],
                description: result[1] + "(" + result[3] + ")",
                mountPath: mountFile,
                freesize: 0,
                size: 0,
                isCard: false,
                isUSB: false,
                isRemovable: false,
                isSystem: false
            });
        }
        return mounts;
    }

    async mountListLinux(): Promise<IMountList[]> {
        const mounts: IMountList[] = [];
        // -e7 filters out squashfs, which is used by Ubuntu's Snap packages
        const result = execSync("lsblk -e7 -Jbo PATH,TYPE,LABEL,PARTLABEL,UUID,PARTUUID,MOUNTPOINT,FSAVAIL,FSSIZE,SIZE,RM,HOTPLUG").toString();
        if ( !result ) {
            return mounts;
        }

        const resultObj = JSON.parse(result);
        let items = resultObj.blockdevices.slice();
        let item = null;

        while ( (item = items.pop()) ) {
            if ( item.children ) {
                items = items.concat( item.children );
                continue;
            }
            if ( !item.mountpoint || item.mountpoint ===  "[SWAP]" ) {
                continue;
            }

            const mountFile = await this.convertFile( item.mountpoint );
            if ( !mountFile ) {
                continue;
            }

            let uuidStr = "";
            if ( item.uuid || item.partuuid) {
                uuidStr = " (" + ( item.uuid || item.partuuid ) + ")";
            }
            mounts.push({
                device: item.path,
                description: (item.label || item.partlabel || item.type) + uuidStr,
                mountPath: mountFile,
                freesize: item.fsavail || 0,
                size: item.fssize || item.size,
                isCard: item.hotplug,
                isUSB: item.rm && item.hotplug,
                isRemovable: item.rm,
                isSystem: !item.rm
            });
        }
        return mounts;
    }

    async mountList(): Promise<IMountList[]> {
        if ( os.platform() === "win32" && parseInt(os.release()) >= 10 ) {
            return this.mountListWin10();
        } else if ( os.platform() === "darwin" ) {
            return this.mountListMac();
        } else {
            return this.mountListLinux();
        }
    }

    static async convertFile( filePath: string, option?: { fileInfo?: any; useThrow?: boolean; checkRealPath?: boolean; virtualFile?: boolean } ): Promise<File> {
        const fileReader = new FileReader();
        return await fileReader.convertFile( filePath, option );
    }

    convertFile( filePath: string, option?: { fileInfo?: any; useThrow?: boolean; checkRealPath?: boolean; virtualFile?: boolean } ): Promise<File> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise( async (resolve, reject) => {
            const { fileInfo, useThrow, checkRealPath } = option || {};
            const file = new File();
            file.fstype = this._readerFsType;

            try {
                if ( filePath === "~" || filePath[0] === "~" ) {
                    file.fullname = os.homedir() + filePath.substr(1);
                } else if ( filePath === ".." || filePath === "." ) {
                    file.fullname = fs.realpathSync(path.join((await this.currentDir()).fullname, filePath));
                } else {
                    file.fullname = checkRealPath ? fs.realpathSync(filePath) : filePath;
                }
                const pathInfo = path.parse( file.fullname );
                file.root = pathInfo.root;
                file.name = pathInfo.base || pathInfo.root;
            } catch( e ) {
                log.error( "convertfile - FAIL : [%s] %j", filePath, e);
                if ( useThrow ) {
                    reject( e );
                    return;
                }
                resolve(null);
                return;
            }
            
            if ( option && option.virtualFile ) {
                file.dir = false;
                file.uid = -1;
                file.gid = -1;
                file.ctime = new Date(0);
                file.mtime = new Date(0);
                file.atime = new Date(0);
                resolve(file);
                return;
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
                        reject(e);
                        return null;
                    }
                    resolve(null);
                    return null;
                }
            }

            if ( (file.attr && file.attr[0] === "l") || (fileInfo && fileInfo.isSymbolicLink()) ) {
                try {
                    const linkOrgName = fs.readlinkSync( file.fullname );
                    file.link = new FileLink( path.basename( linkOrgName ) );

                    const linkStat = fs.lstatSync( linkOrgName );
                    if ( linkStat && !linkStat.isSymbolicLink() ) {
                        file.link.file = await this.convertFile( linkOrgName );
                    }
                } catch ( e ) {
                    log.error( "convertfile - FAIL 3 : [%s] %j", filePath, e);
                }
            }
            resolve(file);
        });
    }

    onWatch( eventFunc: (event?: string, name?: string) => void ) {
        if ( this.watcher ) {
            this.watcher.close();
            this.watcher = null;
        }
        this.watchEventFunc = eventFunc;
    }

    async changeDir( dirFile: File ): Promise<void> {
        if ( dirFile && dirFile.fullname ) {
            process.chdir( dirFile.fullname );
        }
    }

    async currentDir(): Promise<File> {
        if ( this._isNotChangeDir && this._curDir ) {
            return this._curDir;
        }
        return await this.convertFile(process.cwd());
    }

    async readdir( dirFile: File, option?: { isExcludeHiddenFile?: boolean; noChangeDir?: boolean }, filter?: (file: File) => boolean ): Promise<File[]> {
        if ( !dirFile.dir ) {
            throw new Error(`Not directory. ${dirFile.name}`);
        }

        const fileItem: File[] = [];
        try {
            if ( !(option && option.noChangeDir) && !this._isNotChangeDir ) {
                process.chdir(dirFile.fullname);
            }

            const fileList: fs.Dirent[] = (fs as any).readdirSync( dirFile.fullname, { encoding: "utf8", withFileTypes: true  } );
            // log.info( "READDIR: PATH: [%s], FILES: %j", dirFile.fullname, fileList );

            for ( const file of fileList ) {
                let dirPath = dirFile.fullname;
                if ( dirPath.substr(dirPath.length - 1, 1) !== path.sep) {
                    dirPath += path.sep;
                }

                const item = await this.convertFile(dirPath + file.name, { fileInfo: file } );
                // log.info( "dirInfo [%s][%s][%s]", dirPath, file.name, item.fullname );
                if ( option && option.isExcludeHiddenFile ) {
                    if ( process.platform !== "win32" && item.name !== ".." && item.name[0] === "." ) {
                        continue;
                    }
                }
                if ( item ) {
                    const isPushItem = filter ? filter( item ) : true;
                    if ( isPushItem ) {
                        fileItem.push( item );
                    }
                }
            }

            if ( this._isNotChangeDir ) {
                this._curDir = dirFile;
            }

            if ( this.watcher ) {
                this.watcher.close();
                this.watcher = null;
            }
            if ( this.watchEventFunc ) {
                this.watcher = fs.watch( dirFile.fullname, (event, eventName) => {
                    this.watchEventFunc && this.watchEventFunc( event, eventName );
                });
            }
        } catch ( e ) {
            log.error( "READDIR () - ERROR %j", e );
            throw e;
        }

        /*
        this.fileTypeUpdate(fileItem).finally( () => {
            resolve( fileItem );
        });
        */
        return fileItem;
    }

    async fileTypeUpdate( fileItem: File[] ) {
        for ( const item of fileItem ) {
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

    exist( source: File | string ): Promise<boolean> {
        return new Promise( resolve => {
            try {
                if ( source instanceof File ) {
                    resolve(!!fs.lstatSync( source.fullname )); 
                    return;
                }
                resolve(!!fs.lstatSync( source )); 
            } catch( e ) {
                log.error( e );
                resolve( false );
            }
            return;
        });
    }

    async newFile(path: string | File, _progress?: ProgressFunc): Promise<void> {
        const name = path instanceof File ? path.fullname : path;
        return new Promise( (resolve, reject) => {
            const result: fs.WriteStream = fs.createWriteStream(name, { mode: 0o644, encoding: null, flags: "w", autoClose: true });
            result.write( "", (err) => {
                if ( result ) {
                    result.close();
                }
                if ( err ) {
                    log.error("NEWFILE ERROR: %s", err);
                    reject( err );
                } else {
                    log.debug("NEWFILE: %s", name);
                    resolve();
                }
            });
        });
    }

    async mkdir( path: string | File, _progress?: ProgressFunc ): Promise<void> {
        return new Promise( (resolve, reject) => {
            if ( path instanceof File ) {
                if ( !path.dir ) {
                    return;
                }
                fs.mkdir( path.fullname, { mode: convertAttrToStatMode(path) }, (err) => {
                    if ( err ) {
                        reject( err );
                    } else {
                        resolve();
                    }
                });
            } else {
                fs.mkdir( path, (err) => {
                    if ( err ) {
                        reject( err );
                    } else {
                        resolve();
                    }
                });
            }
        });
    }
    
    rename( source: File, rename: string, _progress?: ProgressFunc ): Promise<void> {
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

    copy(source: File | File[], sourceBaseDir: File, targetDir: File, progress?: ProgressFunc): Promise<void> {
        return new Promise( ( resolve, reject ) => {
            if ( Array.isArray(source) ) {
                reject( "Unsupport file array type !!!" );
                return;
            }

            const srcFile = source;
            if ( source.link ) {
                try {
                    if ( fs.existsSync(targetDir.fullname) ) {
                        fs.unlinkSync(targetDir.fullname);
                    }
                    if ( source.link.file ) {
                        fs.symlinkSync( source.link.file.fullname, targetDir.fullname, source.link.file.dir ? "dir" : "file" );
                    } else {
                        fs.symlinkSync( source.link.name, targetDir.fullname );
                    }
                } catch( e ) {
                    log.error( e );
                    reject( e );
                    return;
                }
                resolve();
                return;
            }

            if ( srcFile.dir || targetDir.dir ) {
                reject("Unable to copy from a source directory.");
                return;
            }

            if ( srcFile.dirname === targetDir.fullname ) {
                log.debug( "source file and target file are the same." );
                resolve();
                return;
            }

            let chunkCopyLength = 0;
            const rd = fs.createReadStream(srcFile.fullname);
            const wr = fs.createWriteStream(targetDir.fullname);

            const rejectFunc = (err) => {
                rd.destroy();
                wr.end(() => {
                    fs.unlinkSync( targetDir.fullname );
                });
                log.debug( "COPY ERROR - " + err );
                reject(err);
            };

            rd.on("error", rejectFunc);
            wr.on("error", rejectFunc);
            wr.on("finish", () => {
                resolve();
            });

            const reportProgress = new Transform({
                transform(chunk: Buffer, encoding, callback) {
                    chunkCopyLength += chunk.length;
                    const result = progress && progress( srcFile, chunkCopyLength, srcFile.size, chunk.length );
                    log.debug( "Copy to: %s => %s (%d / %d)", srcFile.fullname, targetDir.fullname, chunkCopyLength, srcFile.size );
                    if ( result === ProgressResult.USER_CANCELED ) {
                        rd.destroy();
                        wr.end(() => {
                            fs.unlinkSync( targetDir.fullname );
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

    static async remove( file: File ) {
        const fileReader = new FileReader();
        return await fileReader.remove( file );
    }

    viewer( file: File, _progress?: ProgressFunc ): Promise<{ orgFile: File; tmpFile: File; endFunc: () => Promise<void> }> {
        return new Promise((resolve) => {
            resolve( { orgFile: file, tmpFile: null, endFunc: null } );
        });
    }

    createFile( fullname: string, option?: { virtualFile?: boolean } ): Promise<File> {
        if ( !(option && option.virtualFile) ) {
            fs.writeFileSync( fullname, "", { mode: 0o644 } );
            return this.convertFile( fullname, { checkRealPath: true } );
        }
        return this.convertFile( fullname, { virtualFile: true } );
    }

    static createFile( fullname: string, option?: { virtualFile?: boolean } ): Promise<File> {
        const fileReader = new FileReader();
        return fileReader.createFile( fullname, option );
    }
}
