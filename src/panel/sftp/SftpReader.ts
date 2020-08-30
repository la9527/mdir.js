import * as fs from "fs";
import { Client } from "ssh2";
import { SocksClient, SocksClientOptions } from "socks";
import { Reader, ProgressFunc, IMountList, ProgressResult } from "../../common/Reader";
import { File } from "../../common/File";
import { Logger } from "../../common/Logger";
import { Transform } from "stream";
import { convertAttrToStatMode } from "../FileReader";
import { Socket } from "net";

const log = Logger("SftpReader");

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

// https://github.com/mscdex/ssh2#client-events
export interface ssh2ConnectionInfo {
    host: string;
    port?: number; // default 22
    forceIPv4?: string;
    forceIPv6?: string;
    localAddress?: string;
    hostHash?: string;
    hostVerifier?: ( hostkey: string, callback?: () => boolean) => void;
    username?: string;
    password?: string;
    agent?: string;
    agentForward?: boolean;
    privateKey?: string | Buffer; // Buffer or string that contains a private key for either key-based or hostbased user authentication (OpenSSH format)
    passphrase?: string; // For an encrypted private key
    localHostname?: string;
    localUsername?: string;
    // tryKeyboard?: boolean;   // Disallow option
    // authHandler?: (methodsLeft, partialSuccess, callback) => void;  // Disallow option
    keepaliveInterval?: number;
    keepaliveCountMax?: number;
    readyTimeout?: number;
    sock?: Socket;
    strictVendor?: boolean;
    algorithms?: {
        kex: any[];
        cipher: any[];
        serverHostKey: any[];
        hmac: any[];
        compress: any[];
    };
    compress?: boolean | "force";
    debug?: () => void;
    proxyInfo?: SocksClientOptions;
}

export class SftpReader extends Reader {
    private client = null;
    private session = null;
    private sftp = null;

    protected _readerFsType = "sftp";
    private homeDirFile: File = null;

    constructor() {
        super();
        this.client = new Client();

        this.client.on("close", () => {
            log.info( "close !!!");
            this.sftp = null;
        });
    }

    public getSSH2Client() {
        return this.client;
    }

    public connect( option: ssh2ConnectionInfo ): Promise<void> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise( async (resolve, reject) => {
            if ( option.proxyInfo ) {
                const { socket } = await SocksClient.createConnection({
                    command: "connect",
                    destination: {
                        host: option.host, 
                        port: option.port
                    },
                    ...option.proxyInfo
                });
                option.sock = socket;
            }
            const onceReady = (err) => {
                if ( err ) {
                    log.error( err );
                    this.client.removeListener("error", onceReady);
                    reject( err );
                    return;
                }                
                this.client.sftp( async (err, sftp) => {
                    if ( err ) {
                        log.error( err );
                        reject( err );
                        return;
                    }
                    this.sftp = sftp;
                    log.info( "SFTP connected !!!" );
                    try {
                        this.homeDirFile = await this.convertFile( "." );
                    } catch( e ) {
                        log.error( e );
                    }
                    resolve();
                });
            };
            this.client.once( "ready", onceReady );
            this.client.once( "error", (err) => {
                log.error( err );
                this.client.removeListener("ready", onceReady);
                reject( err );
            } );
            log.info( "Client connect - [%s:%d] - [%s]", option.host, option.port || 22, option.username );
            this.client.connect( option );
        });
    }

    private sftpRealPath(path: string): Promise<string> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }
        return new Promise( (resolve, reject) => {
            try {
                this.sftp.realpath(path, (err, absPath) => {
                    if ( err ) {
                        log.error(`realpath stat error ${err.message} code: ${err.code}`);
                        reject( err );
                        return;
                    }
                    resolve( absPath );
                });
            } catch( e ) {
                log.error( e );
                reject( e );
            }
        });
    }

    private sftpStat(path: string): Promise<any> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }
        return new Promise( (resolve, reject) => {
            try {
                this.sftp.lstat(path, (err, stats) => {
                    if ( err ) {
                        log.error(`sftp lstat error ${err.message} code: ${err.code} - path: ${path}`);
                        reject( err );
                        return;
                    }
                    resolve(stats);
                });
            } catch ( e ) {
                reject( e );
            }
        });
    }

    async convertFile(path: string, _option?: any): Promise<File> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }
        const file = new File();
        file.fstype = this._readerFsType;
        file.fullname = await this.sftpRealPath( path );
        const stat = await this.sftpStat( file.fullname );
        file.attr = convertAttr( stat );
        file.dir = stat.isDirectory();
        file.size = stat.size;
        file.attr = convertAttr( stat );
        file.uid = stat.uid;
        file.gid = stat.gid;
        file.ctime = stat.ctime;
        file.mtime = stat.mtime;
        file.atime = stat.atime;
        return file;
    }
    
    readdir(dir: File, _option?: { isExcludeHiddenFile?: boolean; noChangeDir?: boolean }): Promise<File[]> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }
        return new Promise( (resolve, reject) => {
            try {
                this.sftp.readdir(dir.fullname, async (err, fileList: any[]) => {
                    if ( err ) {
                        reject( err );
                        return;
                    }
                    const result: File[] = [];
                    for ( const item of fileList ) {
                        const file = await this.convertFile( item.filename );
                        if ( item.longname ) {
                            const longInfo = item.longname.split(" ").filter( item => item.length > 0 );
                            if ( longInfo.length > 3) {
                                file.owner = longInfo[2];
                                file.group = longInfo[3];
                            }
                        }
                        result.push( file );
                    }
                    resolve( result );
                });
            } catch( err ) {
                log.error( err );
                reject( err );
            }
        });
    }
    
    async homeDir(): Promise<File> {
        return this.homeDirFile || await this.rootDir();
    }
    
    async rootDir(): Promise<File> {
        return await this.convertFile("/");
    }
    
    mountList(): Promise<IMountList[]> {
        throw new Error("Unsupport sftp mountlist()");
    }

    async changeDir(_dirFile: File): Promise<void> {
        log.warning( "unsupport change dir" );
    }

    async currentDir(): Promise<File> {
        return await this.convertFile(".");
    }

    sep(): string {
        return "/";
    }

    async exist(source: string | File): Promise<boolean> {
        const src = source instanceof File ? source.fullname : source;
        try {
            const result = await this.sftpStat( src );
            return !!result;
        } catch( e ) {
            return false;
        }
    }

    async mkdir(path: string | File, _progress?: ProgressFunc): Promise<void> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }
        const name = path instanceof File ? path.fullname : path;

        return new Promise( (resolve, reject) => {
            this.sftp.mkdir( name, (err) => {
                if ( err ) {
                    log.debug("MKDIR ERROR: %s", err);
                    reject( err );
                } else {
                    log.debug("MKDIR: %s", name);
                    resolve();
                }
            });
        });
    }

    rename(source: File, rename: string, _progress?: ProgressFunc): Promise<void> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }
        return new Promise( (resolve, reject) => {
            this.sftp.rename( source.fullname, rename, (err) => {
                if ( err ) {
                    reject( err );
                } else {
                    log.debug( "RENAME : %s => %s", source.fullname, rename );
                    resolve();
                }
            });
        });
    }

    copy(source: File | File[], _sourceBaseDir: File, targetDir: File, progress?: ProgressFunc): Promise<void> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }
        return new Promise( ( resolve, reject ) => {
            if ( Array.isArray(source) ) {
                reject( "Unsupport file array type !!!" );
                return;
            }

            if ( source.fstype === targetDir.fstype ) {
                reject( `Unsupport file type !!! source: ${source.fstype}, target ${targetDir.fstype}` );
                return;
            }

            const srcFile = source.link ? source.link.file : source;
            if ( srcFile.dir || targetDir.dir ) {
                reject("Unable to copy from a source directory.");
                return;
            }

            const fileMode = {
                mode: convertAttrToStatMode(srcFile) || 0o644
            };
            let chunkCopyLength = 0;
            const rd = srcFile.fstype === "file" ? fs.createReadStream(srcFile.fullname) : this.sftp.createReadStream(srcFile.fullname);
            const wr = targetDir.fstype === "file" ? fs.createWriteStream(targetDir.fullname, fileMode) : this.sftp.createWriteStream(targetDir.fullname, fileMode);

            const rejectFunc = (err) => {
                rd.destroy();
                wr.end(() => {
                    if ( targetDir.fstype === "file" ) {
                        fs.unlinkSync( targetDir.fullname );
                    } else {
                        this.sftp.unlink( targetDir.fullname );
                    }
                });
                log.debug( "COPY ERROR - " + err );
                reject(err);
            };

            rd.on("error", rejectFunc);
            wr.on("error", rejectFunc);
            wr.on("finish", () => {
                resolve();
            });

            const sftp = this.sftp;
            const reportProgress = new Transform({
                transform(chunk: Buffer, encoding, callback) {
                    chunkCopyLength += chunk.length;
                    const result = progress && progress( srcFile, chunkCopyLength, srcFile.size, chunk.length );
                    log.debug( "Copy to: %s => %s (%d / %d)", srcFile.fullname, targetDir.fullname, chunkCopyLength, srcFile.size );
                    if ( result === ProgressResult.USER_CANCELED ) {
                        rd.destroy();
                        wr.end(() => {
                            if ( targetDir.fstype === "file" ) {
                                fs.unlinkSync( targetDir.fullname );
                            } else {
                                sftp.unlink( targetDir.fullname );
                            }
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

    remove(source: File, _progress?: ProgressFunc): Promise<void> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }

        return new Promise( (resolve, reject) => {
            if ( source.dir ) {
                this.sftp.rmdir( source.fullname, (err) => {
                    if ( err ) {
                        reject( err );
                    } else {
                        log.debug( "REMOVE : %s", source.fullname );
                        resolve();
                    }
                });
            } else {
                this.sftp.unlink( source.fullname, (err) => {
                    if ( err ) {
                        reject( err );
                    } else {
                        log.debug( "REMOVE : %s", source.fullname );
                        resolve();
                    }
                });
            }
        });
    }
}