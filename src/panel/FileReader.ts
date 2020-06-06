import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as drivelist from "drivelist";

import { File, FileLink } from "../common/File";
import { Logger } from "../common/Logger";
import { Reader, IMountList, ProgressFunc } from "../common/Reader";

import { ColorConfig } from "../config/ColorConfig";
import { rejects } from "assert";
import { Transform } from "stream";

const log = Logger("FileReader");

const convertAttr = ( stats: fs.Stats ): string => {
    const fileMode: string[] = "----------".split("");
    fileMode[0] = stats.isSymbolicLink() ? "l" : (stats.isDirectory() ? "d" : "-");
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

export class FileReader extends Reader {
    protected _readerFsType = "file";

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
            item.mountpoints.forEach( (i) => {
                mounts.push( { device: item.device, mountPath: this.convertFile( i.path ), size: item.size, name: i.path });
            });
        });
        return mounts;
    }

    convertFile( filePath: string ): File {
        const file = new File();
        file.fstype = this._readerFsType;

        try {
            if ( filePath === "." || filePath === ".." ) {
                file.fullname = fs.realpathSync( filePath );
            } else {
                file.fullname = filePath;
            }

            // log.debug( "FILE [%s]", file.fullname );
            const stat = fs.lstatSync( filePath );

            const pathInfo = path.parse( file.fullname );
            file.root = pathInfo.root;
            file.name = pathInfo.base || pathInfo.root;
            file.size = stat.size;
            if ( process.platform === "win32" ) {
                file.attr = convertAttr( stat );
            } else {
                file.attr = convertAttr( stat );
                file.owner = "" + stat.uid;
                file.group = "" + stat.gid;
            }
            file.dir = stat.isDirectory();
            if ( stat.isSymbolicLink() ) {
                try {
                    const linkOrgName = fs.readlinkSync( file.fullname );
                    file.link = new FileLink( path.basename( linkOrgName ) );

                    const linkStat = fs.lstatSync( linkOrgName );
                    if ( linkStat && !linkStat.isSymbolicLink() ) {
                        file.link.file = this.convertFile( linkOrgName );
                    }
                } catch ( e ) {
                    log.error( "FAIL - 2: %j", e);
                }
            } else {
                file.fullname = fs.realpathSync( filePath );
            }
            file.ctime = stat.ctime;
            file.mtime = stat.mtime;
        } catch ( e ) {
            log.error( "FAIL - 3: [%s] %j", filePath, e);
            return null;
        }
        file.color = ColorConfig.instance().getFileColor( file );
        return file;
    }

    currentDir(): File {
        return this.convertFile(process.cwd());
    }

    readdir( dirFile: File ): Promise<File[]> {
        return new Promise<File[]>( (resolve, reject ) => {
            if ( !dirFile.dir ) {
                reject(`Not directory. ${dirFile.name}`);
                return;
            }

            const fileItem: File[] = [];
            try {
                process.chdir(dirFile.fullname);

                const fileList: any[] = fs.readdirSync( dirFile.fullname, { encoding: "utf-8" } );
                // log.info( "READDIR: PATH: [%s], FILES: %j", dirFile.fullname, fileList );
                fileList.map( (file) => {
                    const item = this.convertFile( dirFile.fullname + path.sep + file );
                    if ( item ) {
                        fileItem.push( item );
                    }
                });
            } catch ( e ) {
                log.error( "READDIR () - ERROR %j", e );
            }
            resolve( fileItem );
        });
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
            let mode = 0;
            mode = mode | (path.attr[1] === 'r' ? fs.constants.S_IRUSR : 0);
            mode = mode | (path.attr[2] === 'w' ? fs.constants.S_IWUSR : 0);
            mode = mode | (path.attr[3] === 'x' ? fs.constants.S_IXUSR : 0);
            mode = mode | (path.attr[4] === 'r' ? fs.constants.S_IRGRP : 0);
            mode = mode | (path.attr[5] === 'w' ? fs.constants.S_IWGRP : 0);
            mode = mode | (path.attr[6] === 'x' ? fs.constants.S_IWGRP : 0);
            mode = mode | (path.attr[7] === 'r' ? fs.constants.S_IROTH : 0);
            mode = mode | (path.attr[8] === 'w' ? fs.constants.S_IWOTH : 0);
            mode = mode | (path.attr[9] === 'x' ? fs.constants.S_IXOTH : 0);
            fs.mkdirSync( path.fullname, { mode } );
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
                wr.end();
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
                    progress && progress( srcFile, chunkCopyLength, srcFile.size );
                    log.debug( "Copy to: %s => %s (%d / %d)", srcFile.fullname, target.fullname, chunkCopyLength, srcFile.size );
                    if ( reader.isUserCanceled ) {
                        rd.destroy();
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
}
