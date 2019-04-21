import { AbstractPanel } from "./AbstractPanel";
import { readerControl } from "./readerControl";
import { Reader } from "../common/Reader";
import { Logger } from "../common/Logger";
import { File } from "../common/File";

const log = Logger("main");

export abstract class Panel extends AbstractPanel {
    protected reader: Reader = null;

    constructor() {
        super();
    }

    initReader( type: string = "file" ) {
        this.reader = readerControl(type);
    }

    async read( path: string ) {
        const previousDir: File = this._currentDir;

        try {
            const file = this.reader.convertFile( path );
            this.dirFiles = await this.reader.readdir( file );
            if ( previousDir ) {
                // search directory
            }
            this._currentDir = file;
            file.name = ".";

            const parentFile = this.reader.convertFile("..");
            parentFile.name = "..";
            this.dirFiles.unshift( parentFile );
            // this.dirFiles.unshift( file );
            log.info( this.dirFiles );
        } catch ( e ) {
            // TODO: Messgae Box
            log.error( e );
        }

        this.sort();
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

    keyEnter() {

    }
}
