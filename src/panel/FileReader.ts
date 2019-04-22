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
        return this.convertFile(os.homedir());
    }

    convertFile( filePath: string ): File {
        const file = new File();
        file.fstype = this._readerFsType;
        try {
            file.fullname = fs.realpathSync( filePath );
            file.name = path.basename( file.fullname );

            const stat = fs.lstatSync( filePath );
            file.size = stat.size;
            file.attr = convertAttr( stat );
            file.dir = stat.isDirectory();
            if ( stat.isSymbolicLink() ) {
                try {
                    const linkname = fs.readlinkSync( file.fullname );
                    file.link = { name: path.basename( linkname ), file: null };

                    const linkStat = fs.lstatSync( linkname );
                    if ( linkStat && !linkStat.isSymbolicLink() ) {
                        file.link.file = this.convertFile( linkname );
                    }
                } catch( e ) {
                    log.error( "FAIL - 2: %j", e);
                    file.link = { name: null, file: null };
                }
            }
            file.ctime = stat.ctime;
            file.mtime = stat.mtime;
        } catch ( e ) {
            if ( filePath === ".." ) {
                file.fullname = filePath;
                file.name = path.basename( file.fullname );
            }
            file.size = 0;
            file.error = e;
            file.ctime = new Date();
            file.mtime = new Date();
            log.error( "FAIL - 3: %j", e);
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
                const fileList: any[] = fs.readdirSync( dirFile.fullname, { encoding: "utf-8" } );
                log.info( "convertFile: %j", fileList );
                fileList.map( (file) => {
                    fileItem.push( this.convertFile( dirFile.fullname + path.sep + file ) );
                });
                process.chdir(dirFile.fullname);
                this.curDir = dirFile;
            } catch ( e ) {
                log.error( "READDIR () - ERROR %j", e );
            }
            resolve( fileItem );
            // reject( e );
        });
    }
}
