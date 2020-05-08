import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { File } from "../common/File";
import { Logger } from "../common/Logger";
import { Reader } from "../common/Reader";

import { ColorConfig } from "../config/ColorConfig";

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

    homeDir(): File {
        return this.convertFile( os.homedir());
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
            file.name = pathInfo.base;
            file.size = stat.size;
            if ( process.platform === "win32" ) {
                file.attr = convertAttr( stat );
            } else {
                file.attr = convertAttr( stat );
            }
            file.dir = stat.isDirectory();
            if ( stat.isSymbolicLink() ) {
                try {
                    const linkOrgName = fs.readlinkSync( file.fullname );
                    file.link = { name: path.basename( linkOrgName ), file: null };

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
                log.info( "READDIR: PATH: [%s], FILES: %j", dirFile.fullname, fileList );
                fileList.map( (file) => {
                    const item = this.convertFile( dirFile.fullname + path.sep + file );
                    if ( item ) {
                        fileItem.push( item );
                    }
                });
                this.curDir = dirFile;
            } catch ( e ) {
                log.error( "READDIR () - ERROR %j", e );
            }
            resolve( fileItem );
            // reject( e );
        });
    }
}
