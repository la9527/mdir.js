import * as fs from "fs";
import * as path from "path";
import { Client } from "ssh2";
import { SocksClient, SocksClientOptions } from "./socks/client/socksclient";
import { Reader, ProgressFunc, IMountList, ProgressResult } from "../../common/Reader";
import { File } from "../../common/File";
import { Logger } from "../../common/Logger";
import { Transform } from "stream";
import { convertAttrToStatMode, FileReader } from "../FileReader";
import { Socket } from "net";
import { Crypto } from "../../common/Crypto";
import Configure from "../../config/Configure";
import { T } from "../../common/Translation";

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

export interface IConnectionInfoBase {
    protocol?: "SFTP" | "SSH" | "SFTP_SSH";
    host?: string;
    port?: number; // default 22
    username?: string;
    password?: string;
    privateKey?: string; // key file path
    proxyInfo?: {
        host?: string;
        port?: number;
        type?: 4 | 5;
        username?: string;
        password?: string;
    };
}

export interface IConnectionInfo {
    name?: string;
    info?: IConnectionInfoBase[];
}

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
    private sftp = null;

    protected _readerFsType = "sftp";
    private homeDirFile: File = null;
    private currentPath: File = null;
    private option: ssh2ConnectionInfo = null;
    private connSessionInfo: IConnectionInfoBase = null;
    private connInfo: IConnectionInfo = null;
    private _isEachConnect: boolean = false;

    constructor() {
        super();
        this.init();
    }

    public destory() {
        this.disconnect();
    }

    public init() {
        this.disconnect();
        this.client = new Client();
    }

    public disconnect() {
        if ( this.client ) {
            log.info( "DISCONNECT: %s", this.getConnectInfo() );
            this.sftp = null;
            this.client.end();
            this.client.destroy();
            this.client = null;
        }
    }

    public getSSH2Client() {
        return this.client;
    }

    public isSFTPSession() {
        return !!this.sftp;
    }

    public getConnectInfo(): string {
        const { host, username, port } = this.option || {};
        if ( this.isSFTPSession() ) {
            return `sftp://${username}@${host}:${port}`;
        }
        return `ssh://${username}@${host}:${port}`;
    }

    public getConnSessionInfo(): IConnectionInfoBase {
        return this.connSessionInfo;
    }

    public getConnInfoConfig(): IConnectionInfo {
        return this.connInfo;
    }

    public isEachConnect() {
        return this._isEachConnect;
    }

    private decryptConnectionInfo( option: ssh2ConnectionInfo ): ssh2ConnectionInfo {
        const result = { ...option };
        result.password = Crypto.decrypt(option.password) || "";
        if (result.proxyInfo && result.proxyInfo.proxy ) {
            result.proxyInfo.proxy.password = Crypto.decrypt(option.proxyInfo.proxy.password) || "";
        }
        return result;
    }

    public convertConnectionInfo(connInfo: IConnectionInfo, protocol: RegExp ): ssh2ConnectionInfo {
        const info: IConnectionInfoBase = connInfo.info.find( item => item.protocol.match( protocol ) );
        if ( !info ) {
            return null;
        }

        log.debug( "convertConnectionInfo: ", info );

        let proxyInfo: SocksClientOptions = null;
        if ( info.proxyInfo ) {
            proxyInfo = {
                command: "connect",
                destination: {
                    host: info.host,
                    port: info.port
                },
                proxy: {
                    host: info.proxyInfo.host,
                    port: info.proxyInfo.port,
                    type: info.proxyInfo.type,
                    userId: info.proxyInfo.username,
                    password: info.proxyInfo.password
                },
                timeout: Configure.instance().getOpensshOption("proxyDefaultTimeout"),
            };
        }
        return {
            host: info.host,
            port: info.port,
            username: info.username,
            password: info.password,
            privateKey: info.privateKey,
            algorithms: Configure.instance().getOpensshOption("algorithms"),
            keepaliveInterval: Configure.instance().getOpensshOption("keepaliveInterval"),
            keepaliveCountMax: Configure.instance().getOpensshOption("keepaliveCountMax"),
            readyTimeout: Configure.instance().getOpensshOption("readyTimeout"),
            proxyInfo: proxyInfo
            /*
            debug: ( ...args: any[] ) => {
                log.debug( "SFTP DBG: %s", args.join(" ") );
            }
            */
        };
    }

    public async connect(connInfo: IConnectionInfo, connectionErrorFunc: ( errInfo: any ) => void ): Promise<string> {
        let option = this.convertConnectionInfo(connInfo, /SFTP/ );
        const sshOption = this.convertConnectionInfo(connInfo, /SSH/ );

        let connectionOnly = false;
        if ( !option && sshOption ) {
            connectionOnly = true;
            option = sshOption;
        }

        const result = await this.sessionConnect( option, connectionErrorFunc, connectionOnly );
        this.connInfo = connInfo;
        this._isEachConnect = !connInfo.info.find( item => item.protocol === "SFTP_SSH" );
        return result;
    }

    public sessionConnect( option: ssh2ConnectionInfo, connectionErrorFunc: ( errInfo: any ) => void, connectionOnly: boolean = false ): Promise<string> {
        log.debug( "CONNECTION INFO: %s", JSON.stringify(option, null, 2) );

        // eslint-disable-next-line no-async-promise-executor
        return new Promise( async (resolve, reject) => {

            if ( !option ) {
                reject( "Empty Connection Configuration !!!" );
                return;
            }
            
            const decryptOption = this.decryptConnectionInfo(option);

            if ( !decryptOption.password || (decryptOption.proxyInfo && !decryptOption.proxyInfo.proxy.password) ) {
                reject( T("Message.PasswordEmpty") );
                return;
            }

            if ( decryptOption.proxyInfo ) {
                try {
                    const { socket } = await SocksClient.createConnection(decryptOption.proxyInfo);
                    log.info( "PROXY CONNECT OK: [%s][%d]", socket.remoteAddress, socket.remotePort );
                    decryptOption.sock = socket;
                } catch( err ) {
                    log.error( "Proxy CONNECTION ERROR - ERORR: %s", err );
                    reject( err );
                    return;
                }
            }
            const onceReady = (err) => {
                if ( err ) {
                    log.error( "Ready - ERORR: %s", err );
                    this.client.removeListener("error", onceReady);
                    reject( err );
                    return;
                }

                if ( !connectionOnly ) {
                    this.client.sftp( async (err, sftp) => {
                        if ( err ) {
                            log.error( "SFTP SESSION - ERORR: %s", err );
                            reject( err );
                            return;
                        }
                        this.sftp = sftp;
                        log.info( "SFTP connected !!!" );
                        this.client.on("error", (err) => {
                            log.error( "SFTP client error: %s", err);
                            connectionErrorFunc(err);
                        });
                        this.client.on("close", (err) => {
                            log.error( "SFTP client close", err);
                            this.disconnect();
                            connectionErrorFunc("close");
                        });

                        try {
                            this.homeDirFile = await this.convertFile( await this.sftpRealPath(".") );
                            this.currentPath = this.homeDirFile;
                        } catch( e ) {
                            log.error( "GET HOME ERROR [%s]", e );
                        }
                        resolve("SFTP");
                    });
                } else {
                    resolve("SESSION_CLIENT");
                }
            };
            this.client.once( "ready", onceReady );
            this.client.once( "error", (err) => {
                if ( err && err.level === "client-authentication" ) {
                    reject( T("Message.AuthenticationFailed" ) );
                    return;
                }
                log.error( "Client ERORR: %s %j", err.level, err );
                this.client.removeListener("ready", onceReady);
                reject( err );
            } );
            // log.debug("connect option : %j", option );
            log.info( "Client connect - [%s:%d] - [%s]", option.host, option.port || 22, option.username );
            this.option = option;
            this.client.connect( decryptOption );
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
                        log.error(`realpath error ${err.message} code: ${err.code}`);
                        reject( err );
                        return;
                    }
                    resolve( absPath );
                });
            } catch( e ) {
                log.error( "realpath exception: %s - %s", e, path );
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
                this.sftp.stat(path, (err, stats) => {
                    if ( err ) {
                        log.error(`sftp lstat error ${err.message} code: ${err.code} - path: ${path}`);
                        reject( err );
                        return;
                    }
                    resolve(stats);
                });
            } catch ( e ) {
                log.error( "sftpStat exception: %s", e);
                reject( e );
            }
        });
    }

    async convertFile(pathStr: string, _option?: any): Promise<File> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }

        if ( pathStr === "~" ) {
            return await this.homeDir();
        } else if ( pathStr === "." ) {
            return this.currentPath.clone();
        } else if ( pathStr === ".." ) {
            pathStr = this.currentPath.dirname;
        } else if ( pathStr[0] === "~" ) {
            pathStr = pathStr.replace("~", (await this.homeDir()).fullname);
        } else if ( pathStr[0] !== "/" ) {
            pathStr = this.currentPath.fullname + this.sep() + pathStr;
        }
        const file = new File();
        file.root = this.getConnectInfo();
        file.fstype = this._readerFsType;

        file.fullname = await this.sftpRealPath( pathStr );
        file.name = path.basename(file.fullname);
        
        const stat = await this.sftpStat( file.fullname );
        file.attr = convertAttr( stat );
        file.dir = stat.isDirectory();
        file.size = stat.size;
        file.attr = convertAttr( stat );
        file.uid = stat.uid;
        file.gid = stat.gid;
        file.ctime = new Date(stat.mtime * 1000);
        file.mtime = new Date(stat.mtime * 1000);
        file.atime = new Date(stat.atime * 1000);
        return file;
    }

    private convertFileForReadDir(item: any, baseDir: File ): File {
        /*
        {
            "filename":".viminfo",
            "longname":"-rw-------   1 1000967  10099999     3343 16 Jul 02:49 .viminfo",
            "attrs": {
                "mode":33152,
                "permissions":33152,
                "uid":1000967,
                "gid":10099999,
                "size":3343,
                "atime":1594835386,
                "mtime":1594835386
            }
        }
        */
        const file = new File();
        file.root = this.getConnectInfo();
        file.fstype = this._readerFsType;

        file.fullname = baseDir.fullname + (baseDir.fullname !== "/" ? this.sep() : "") + item.filename;
        file.name = path.basename(file.fullname);

        const longInfo = item.longname.split(" ").filter( item => item.length > 0 );
        if ( longInfo.length > 3) {
            const attrs = item.attrs;

            file.owner = longInfo[2];
            file.group = longInfo[3];
            file.attr = longInfo[0];
            file.dir = file.attr[0] === "d";
            file.size = attrs.size;
            file.uid = attrs.uid;
            file.gid = attrs.gid;
            file.ctime = new Date(attrs.mtime * 1000);
            file.mtime = new Date(attrs.mtime * 1000);
            file.atime = new Date(attrs.atime * 1000);
        } else {
            return null;
        }
        return file;
    }
    
    readdir(dir: File, _option?: { isExcludeHiddenFile?: boolean; noChangeDir?: boolean }): Promise<File[]> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }
        return new Promise( (resolve, reject) => {
            try {
                log.debug( "READDIR: %s", dir.fullname );
                this.sftp.readdir(dir.fullname, async (err, fileList: any[]) => {
                    if ( err ) {
                        log.error( "error readdir [%s]", err );
                        reject( err );
                        return;
                    }
                    const result: File[] = [];
                    for ( const item of fileList ) {
                        try {
                            log.debug( "READDIR LIST: [%j]", item );
                            const file = this.convertFileForReadDir( item, dir );
                            if ( file ) {
                                result.push( file );
                            }
                        } catch( e ) {
                            log.error( "readdir - %j", e );
                        }
                    }
                    this.currentPath = dir;
                    resolve( result );
                });
            } catch( err ) {
                log.error( "readdir error: [%s]", err );
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
        log.info( "SFTP EXIST : %s", source);
        const src = source instanceof File ? source.fullname : source;
        try {
            const result = await this.sftpStat( src );
            return !!result;
        } catch( e ) {
            log.error( "exist exception: %s", e );
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
                    log.error("MKDIR ERROR: %s", err);
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
                    log.error("RENAME ERROR: %s", err);
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

            /*
            const fileMode = {
                mode: null // convertAttrToStatMode(srcFile) || 0o644
            };

            const step = ( total_transfered: number, chunk: number, total: number ) => {
                progress && progress( srcFile, total_transfered, srcFile.size, chunk );
                log.debug( "Copy to: %s => %s (%d / %d)", srcFile.fullname, targetDir.fullname, total_transfered, srcFile.size );
            };

            if ( srcFile.fstype === "file" ) {
                this.sftp.fastPut( srcFile.fullname, targetDir.fullname, { step, mode: fileMode.mode }, (err) => {
                    if ( err ) {
                        reject( err );
                    } else {
                        resolve();
                    }
                });
            } else {
                this.sftp.fastGet( srcFile.fullname, targetDir.fullname, { step, mode: fileMode.mode }, (err) => {
                    if ( err ) {
                        reject( err );
                    } else {
                        resolve();
                    }
                });
            }
            */

            let rejectCalled = false;
            try {
                const fileMode = {
                    mode: convertAttrToStatMode(srcFile) || 0o644
                };
                let chunkCopyLength = 0;
                const rd = srcFile.fstype === "file" ? fs.createReadStream(srcFile.fullname) : this.sftp.createReadStream(srcFile.fullname);
                const wr = targetDir.fstype === "file" ? 
                    fs.createWriteStream(targetDir.fullname, fileMode) : 
                    this.sftp.createWriteStream(targetDir.fullname, { ...fileMode, encoding: null, flags: "w", autoClose: true });

                const rejectFunc = (err) => {
                    if ( rejectCalled ) {
                        log.debug( "reject called !!!");
                        return;
                    }
                    rejectCalled = true;
                    try {
                        log.error( "COPY ERROR - %s", err );
                        rd.destroy();
                        wr.end(() => {
                            try {
                                if ( targetDir.fstype === "file" ) {
                                    fs.unlinkSync( targetDir.fullname );
                                } else {
                                    this.sftp?.unlink( targetDir.fullname );
                                }
                            } catch( e ) {
                                console.log( err );
                            }
                        });
                    } catch( e ) {
                        log.error( "COPY ERROR - " + e );
                    } finally {
                        reject(err);
                    }
                };

                rd.on("error", rejectFunc);
                wr.on("error", rejectFunc);
                wr.on("finish", () => {
                    log.debug( "Copy to: %s %s => %s %s (%d / %d) - FINISH !!!", srcFile.fstype, srcFile.fullname, targetDir.fstype, targetDir.fullname, chunkCopyLength, srcFile.size );
                    resolve();
                });
                this.client.on("close", () => {
                    this.disconnect();
                    rejectFunc("connection close.");
                });

                const sftp = this.sftp;
                const reportProgress = new Transform({
                    transform(chunk: Buffer, encoding, callback) {
                        chunkCopyLength += chunk.length;
                        const result = progress && progress( srcFile, chunkCopyLength, srcFile.size, chunk.length );
                        log.debug( "Copy to: %s %s => %s %s (%d / %d)", srcFile.fstype, srcFile.fullname, targetDir.fstype, targetDir.fullname, chunkCopyLength, srcFile.size );
                        if ( result === ProgressResult.USER_CANCELED ) {
                            try {
                                rd.destroy();
                                wr.end(() => {
                                    try {
                                        if ( targetDir.fstype === "file" ) {
                                            fs.unlinkSync( targetDir.fullname );
                                        } else {
                                            sftp.unlink( targetDir.fullname );
                                        }
                                    } catch( e ) {
                                        log.error( e );
                                    }
                                });
                            } catch( e ) {
                                log.error( e );
                            }
                            log.debug( "COPY - CANCEL" );
                            reject( "USER_CANCEL" );
                            return;
                        }
                        callback( null, chunk );
                    }
                });
                rd.pipe( reportProgress ).pipe(wr);
            } catch( e ) {
                log.error( "COPY Exception !!! - %s", e );
                reject( e );
            }
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

    async viewer( file: File, progress?: ProgressFunc ): Promise<{ orgFile: File; tmpFile: File; endFunc: () => void }> {
        if ( !this.sftp ) {
            throw new Error("disconnected sftp");
        }

        if ( file.dir ) {
            log.debug( "Unable to view the directory in the viewer.");
            return null;
        }

        if ( file.root !== this.getConnectInfo() ) {
            throw new Error("viewer file is not SftpReader");
        }

        const tmpFileDirName = path.join((global as any).fsTmpDir, "viewer");
        if ( !fs.existsSync( tmpFileDirName ) ) {
            fs.mkdirSync( tmpFileDirName );
        }

        const tmpFile = await FileReader.convertFile( path.join(tmpFileDirName, file.name), { virtualFile: true } );
        await this.copy( file, null, tmpFile, progress );

        const endFunc = () => {
            try {
                fs.rmdirSync( path.join((global as any).fsTmpDir, "viewer"), { recursive: true } );
            } catch( e ) {
                log.error( e );
            }
            return;
        };
        return { orgFile: file, tmpFile, endFunc };
    }
}
