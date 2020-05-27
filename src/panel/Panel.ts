import { AbstractPanel } from "./AbstractPanel";
import { Reader } from "../common/Reader";
import { Logger } from "../common/Logger";
import { File } from "../common/File";

const log = Logger("main");

export abstract class Panel extends AbstractPanel {
    protected reader: Reader = null;

    constructor() {
        super();
    }

    initReader( reader: Reader ) {
        this.reader = reader;
    }

    async read( path: string ) {
        const previousDir: File = this._currentDir;

        try {
            const file = this.reader.convertFile( path );
            log.info( "Panel: %s", path );
            this.dirFiles = await this.reader.readdir( file );

            this._currentDir = file;
            file.name = ".";

            try {
                const parentFile = this.reader.convertFile("..");
                if ( parentFile.fullname !== file.fullname ) {
                    parentFile.name = "..";
                    this.dirFiles.unshift( parentFile );
                }
            } catch ( e ) {
                log.error( "PARENT DIR READ FAILED %j", e );
            }
            log.info( "FIND LIST: %s", JSON.stringify(this.dirFiles.map((item) => `${item.fullname} - ${item.name}`), null, 4) );
            this.sort();
            
            if ( previousDir ) {
                // search directory
                const befPos = this.dirFiles.findIndex( (file: File) => {
                    log.debug( "file.fullname: [%s]", file.fullname );
                    return file.fullname === previousDir.fullname;
                });
                log.debug( "BEFORE DIR: %s, befPos: %d", previousDir.fullname, befPos );
                if ( befPos > -1 ) {
                    this.currentPos = befPos;
                }
            }
        } catch ( e ) {
            // TODO: Messgae Box
            log.error( "READ ERROR %j", e );
        }
    }

    refresh() {
        
    }

    abstract initRender(): void;
    abstract beforeRender(): void;
    abstract render(): void;

    toggleSelect() {
        if ( this.dirFiles[this.currentPos] ) {
            this.dirFiles[this.currentPos].select = !this.dirFiles[ this.currentPos ].select;
            this.keyDown();
        }
    }

    currentFile(): File {
        try {
            return this.dirFiles[this.currentPos];
        } catch ( e ) {
            log.error( e );
        }
        return null;
    }

    async keyEnterPromise() {
        const currentFile: File = this.dirFiles[this.currentPos];
        if ( currentFile.dir ) {
            try {
                await this.read( currentFile.fullname );
            } catch( e ) {
                log.error( "keyEnterPromise exception : %j", e );
            }
        }
        log.debug( "keyEnterPromise !!!" );
    }
}
