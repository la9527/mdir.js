import { AbstractPanel } from "./AbstractPanel";
import { Reader } from "../common/Reader";
import { Logger } from "../common/Logger";
import { File } from "../common/File";
import { SortType } from "../common/Sort";
import { IHelpService, Help, RefreshType } from '../config/KeyMapConfig';
import { T } from "../common/Translation";

const log = Logger("main");

export abstract class Panel extends AbstractPanel implements IHelpService {
    protected reader: Reader = null;
    protected _excludeHiddenFile = false;

    constructor( reader: Reader = null ) {
        super();
        this.setReader( reader );
    }

    viewName() {
        return "Panel";
    }

    setReader( reader: Reader ) {
        this.reader = reader;
    }

    getReader(): Reader {
        return this.reader;
    }

    async read( path: string | File ): Promise<void> {
        const previousDir: File = this._currentDir;

        const file = (path instanceof File) ? path : this.reader.convertFile( path, null, true );
        log.info( "Panel: %s", file.fullname );
        this.dirFiles = await this.reader.readdir( file, { isExcludeHiddenFile: this._excludeHiddenFile } );

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
        //log.info( "FIND LIST: %s", JSON.stringify(this.dirFiles.map((item) => `${item.fullname} - ${item.name}`), null, 4) );
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
            this._previousDir = previousDir;
        }
    }

    async refreshPromise(): Promise<void> {
        await this.read( this.currentPath() );
    }

    abstract initRender(): void;
    abstract beforeRender(): void;
    abstract render(): void;

    validCheckPosition() {
        if ( this.currentPos > this.dirFiles.length - 1 ) {
            this.currentPos = this.dirFiles.length - 1;
        } else if ( this.currentPos < 0 ) {
            this.currentPos = 0;
        }
    }

    @Help(T("select/unselect a file."))
    toggleSelect() {
        this.validCheckPosition();

        if ( this.dirFiles[this.currentPos] ) {
            if ( this.dirFiles[this.currentPos].name !== ".." ) {
                this.dirFiles[this.currentPos].select = !this.dirFiles[ this.currentPos ].select;
            }
            this.keyDown();
        }
    }

    selectAllFiles() {
        this.validCheckPosition();

        for ( let i in this.dirFiles ) {
            if ( this.dirFiles[i].name !== ".." ) {
                this.dirFiles[i].select = true;
            }
        }
    }

    currentPath(): File {
        return this._currentDir;
    }

    currentFile(): File {
        this.validCheckPosition();

        try {
            return this.dirFiles[this.currentPos];
        } catch ( e ) {
            log.error( e );
        }
        return null;
    }

    focusFile( file: File ): boolean {
        if ( !file ) {
            log.debug( "focusFile FILE IS NULL" );
            return false;
        }
        const findIndex = this.dirFiles.findIndex( (item) => item.equal(file) );
        log.debug( "focusFile [%s] FIND - [%d]", file.name, findIndex );
        if ( findIndex > -1 ) {
            this.currentPos = findIndex;
            log.debug( "focusFile : [%d], [%s]", this.currentPos, this.currentFile()?.name);
            return true;
        }
        return false;
    }

    async keyEnterPromise() {
        this.validCheckPosition();

        const currentFile: File = this.dirFiles[this.currentPos];
        if ( currentFile.dir ) {
            try {
                await this.read( currentFile.fullname );
            } catch( e ) {
                log.error( "keyEnterPromise exception : %j", e );
            }
            return true;
        }
        return false;
    }

    getSelectFiles() {
        let selectItems = this.dirFiles.filter( item => item.select );
        if ( selectItems.length > 0 ) {
            return selectItems;
        }
        if ( this.currentFile()?.name !== ".." ) {
            return [ this.currentFile() ];
        }
        return null;
    }

    @Help(T("go to home directory."))
    async gotoHomePromise() {
        await this.read( this.reader.homeDir() );
    }

    @Help(T("go to root directory."))
    async gotoRootPromise() {
        await this.read( this.reader.rootDir() );
    }

    @Help(T("go to parent directory."))
    async gotoParentPromise() {
        await this.read( ".." );
    }

    toggleExcludeHiddenFile() {
        this._excludeHiddenFile = !this._excludeHiddenFile;
    }

    viewReset() {
        this._excludeHiddenFile = false;
        this._sortReverse = false;
        this.sortType = SortType.COLOR;        
    }
}
