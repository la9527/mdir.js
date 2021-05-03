/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-async-promise-executor */
import { Reader, ProgressFunc, IMountList } from "../../common/Reader";
import { File, FileLink } from "../../common/File";
import { Logger } from "../../common/Logger";
import { ArchiveCommon } from "./ArchiveCommon";
import { ArchiveTarGz } from "./ArchiveTarGz";
import { ArchiveZip } from "./ArchiveZip";
import * as path from "path";
import { FileReader } from "../FileReader";
import * as fs from "fs";
import * as os from "os";

const log = Logger("Archive");

export class ArchiveReader extends Reader {
    private baseArchiveFile: File;
    private archiveObj: ArchiveCommon = null;
    private archiveFiles: File[] = [];
    private baseDir: File;
    protected _readerFsType = "archive";

    destory() {
        // 
    }

    getBaseArchiveFile() {
        return this.baseArchiveFile;
    }

    async setArchiveFile( file: File, progressFunc: ProgressFunc ): Promise<boolean> {
        const archiveObjs = [ new ArchiveTarGz(), new ArchiveZip() ];
        this.archiveObj = archiveObjs.find( item => item.setFile( file ) );
        if ( !this.archiveObj ) {
            return false;
        }
        this.baseArchiveFile = file;
        log.info( "Archive Type: [%s] [%s]", file.name, this.archiveObj.getSupportType());
        this.archiveFiles = await this.archiveObj.getArchivedFiles(progressFunc);
        this.baseDir = await this.rootDir();
        return true;
    }

    async convertFile(path: string, _option?: any): Promise<File> {
        if ( !path ) {
            return null;
        } else if ( path === "." ) {
            return this.baseDir;
        } else if ( path === ".." ) {
            let file = await this.rootDir();
            if ( this.baseDir.fullname !== this.sep() && this.baseDir.dirname !== this.sep() ) {
                file = await this.convertFile(this.baseDir.dirname + this.sep());
            } else {
                file = await this.rootDir();
            }
            file.name = "..";
            return file;
        } else if ( path === this.sep() ) {
            return await this.rootDir();
        }
        const result = this.archiveFiles.find( (item) => {
            return item.fullname === path;
        });
        return result ? result.clone() : null;
    }

    readdir(dir: File, _option?: { isExcludeHiddenFile?: boolean; noChangeDir?: boolean }): Promise<File[]> {
        let resultFile = [];
        if ( dir.fstype === "archive" ) {
            resultFile = this.archiveFiles.filter( (item) => {
                if ( dir.fullname === item.fullname ) {
                    return false;
                }
                if ( item.fullname.startsWith(dir.fullname) ) {
                    const idx = item.fullname.indexOf("/", dir.fullname.length);
                    if ( idx === -1 || idx === item.fullname.length - 1) {
                        return true;
                    }
                }
                return false;
            }).map( item => item.clone() );
            this.baseDir = dir.clone();
        }
        return new Promise((resolve) => {
            resolve( resultFile );
        });
    }
 
    async homeDir(): Promise<File> {
        return this.rootDir(); 
    }

    async rootDir(): Promise<File> {
        const file = new File();
        file.fstype = "archive";
        file.fullname = "/";
        file.orgname = "";
        file.name = "/";
        file.owner = "";
        file.group = "";
        file.uid = 0;
        file.gid = 0;
        file.mtime = new Date();
        file.atime = new Date();
        file.ctime = new Date();
        file.root = this.baseArchiveFile.fullname;
        file.attr = "drwxr-xr-x";
        file.size = 0;
        file.dir = true;
        return file;
    }

    mountList(): Promise<IMountList[]> {
        return null;
    }

    async changeDir(_dirFile: File) {
        throw new Error("Unsupport changedir");
    }

    async currentDir(): Promise<File> {
        return this.baseDir;
    }

    sep(): string {
        return "/";
    }

    async exist(source: string | File): Promise<boolean> {
        if ( !source ) {
            return false;
        }
        return !!this.archiveFiles.find( (item) => {
            if ( source instanceof File ) {
                return item.fullname === source.fullname;
            }
            return item.fullname === source;
        });
    }

    async newFile(pathStr: string | File, progress?: ProgressFunc): Promise<void> {
        return new Promise((resolve, reject) => {
            reject( "Unsupport new file !!!" );
        });
    }

    async mkdir(pathStr: string | File, progress?: ProgressFunc): Promise<void> {
        let file: File = null;
        if ( typeof(pathStr) === "string" ) {
            file = this.baseDir.clone();
            file.fullname = path.posix.normalize(pathStr) + path.posix.sep;
            file.name = path.posix.basename(file.fullname);
            file.orgname = file.fullname.replace(/^\//, "");
        } else {
            file = pathStr;
        }
        return new Promise( async (resolve, reject) => {
            try {
                await this.archiveObj.compress( [ file ], null, this.baseDir, progress);
                await this.setArchiveFile( this.baseArchiveFile, progress );
                resolve();
            } catch( e ) {
                reject( e );
            }
        });
    }

    rename(source: File, rename: string, progress?: ProgressFunc): Promise<void> {
        return new Promise( async (resolve, reject) => {
            try {
                await this.archiveObj.rename(source, rename, progress);
                await this.setArchiveFile( this.baseArchiveFile, progress );
                resolve();
            } catch( e ) {
                reject( e );
            }
        });
    }

    copy(source: File | File[], sourceBaseDir: File, targetDir: File, progress?: ProgressFunc): Promise<void> {
        if ( Array.isArray( source ) && source.length > 0 && source[0].fstype === "archive" && targetDir.fstype === "file") {
            return this.archiveObj.uncompress(targetDir, source, progress);
        } else if ( Array.isArray( source ) && source.length > 0 && source[0].fstype === "file" && targetDir.fstype === "archive" ) {
            return new Promise( async (resolve, reject) => {
                try {
                    await this.archiveObj.compress(source, sourceBaseDir, targetDir, progress);
                    await this.setArchiveFile( this.baseArchiveFile, progress );
                    resolve();
                } catch( e ) {
                    reject( e );
                }
            });
        }
        return new Promise((resolve, reject) => {
            reject( "Unsupport copy !!!" );
        });
    }

    async viewer( file: File, progress?: ProgressFunc ): Promise<{ orgFile: File; tmpFile: File; endFunc: () => void }> {
        if ( file.dir ) {
            log.debug( "Unable to view the directory in the viewer.");
            return null;
        }
        if ( file.fstype !== "archive" ) {
            throw new Error("viewer file is not file");
        }
        
        const tmpFileDirName = path.join((global as any).fsTmpDir, "viewer");
        if ( !fs.existsSync( tmpFileDirName ) ) {
            fs.mkdirSync( tmpFileDirName );
        }

        const tmpDir = await FileReader.convertFile( tmpFileDirName );
        await this.archiveObj.uncompress(tmpDir, [ file ], progress);

        const tmpFile = await FileReader.convertFile( path.join(tmpDir.fullname, file.name), { checkRealPath: true } );
        const endFunc = () => {
            try {
                fs.rmdirSync( path.join((global as any).fsTmpDir, "viewer"), { recursive: true } );
            } catch( e ) {
                log.error( e );
            }
            return;
        };
        return { orgFile: file, tmpFile: tmpFile, endFunc };
    }

    remove(source: File | File[], progress?: ProgressFunc): Promise<void> {
        return new Promise( async (resolve, reject) => {
            if ( Array.isArray( source ) ) {
                try {
                    await this.archiveObj.remove(source, progress);
                    await this.setArchiveFile( this.baseArchiveFile, progress );
                    resolve();
                } catch( e ) {
                    reject( e );
                }
            } else {
                reject( "only support array source files !!!" );
            }
        });
    }
}
