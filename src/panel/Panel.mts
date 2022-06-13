import { AbstractPanel } from "./AbstractPanel.mjs";
import { Reader } from "../common/Reader.mjs";
import { Logger } from "../common/Logger.mjs";
import { File } from "../common/File.mjs";
import { SortType } from "../common/Sort.mjs";
import { IHelpService, Help } from "../config/KeyMapConfig.mjs";
import { T } from "../common/Translation.mjs";

const log = Logger("main");

export class DirHistory {
    private pos = -1;
    private dirHistory: File[] = [];

    public get() {
        if ( this.pos < -1 || this.pos >= this.dirHistory.length ) {
            return null;
        }
        return this.dirHistory[this.pos];
    }

    public add( file: File ) {
        if ( !file ) {
            return;
        }
        if ( this.pos > -1 ) {
            if ( this.get().fstype != file.fstype ) {
                this.clear();
            }
        }
        this.dirHistory.splice( this.pos, null, file.clone() );
        this.pos++;

        log.warn( "HISTORY ADD - %d [%s]", this.pos, this.dirHistory.map( (i) => i.fullname ) );
    }

    public prev(): File {
        if ( this.pos <= -1 ) {
            return null;
        }
        const result = this.get();
        if ( this.pos > 0 ) {
            this.pos--;
        }
        log.warn( "HISTORY PREV - %d [%s]", this.pos, result?.fullname );
        return result;
    }

    public next(): File {
        const result = this.get();
        if ( this.pos + 1 < this.dirHistory.length ) {
            this.pos++;
        }
        log.warn( "HISTORY NEXT - %d [%s]", this.pos, result?.fullname );
        return result;
    }

    public clear() {
        this.dirHistory = [];
        this.pos = -1;
    }
}

export abstract class Panel extends AbstractPanel implements IHelpService {
    protected reader: Reader = null;
    protected _excludeHiddenFile = false;
    protected dirHistory: DirHistory = new DirHistory();
    
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

    async read( path: string | File, option: { isNoSaveHistory?: boolean; allowThrow?: boolean } = {} ): Promise<void> {
        const previousDir: File = this._currentDir;

        const file = (path instanceof File) ? path : await this.reader.convertFile( path, { useThrow: true, checkRealPath: true } );
        log.info( "Panel - read: [%s]", file.fullname );

        this.dirFiles = await this.reader.readdir( file, { isExcludeHiddenFile: this._excludeHiddenFile }, (file: File) => {
            return this.filter( file );
        });

        this._currentDir = file;
        file.name = ".";

        try {
            const parentFile = await this.reader.convertFile("..");
            if ( parentFile ) {
                log.debug( "read() - parentFile [%s] [%s] [%s]", parentFile.fstype, parentFile.fullname, parentFile.name);
            }
            if ( parentFile && parentFile.fstype === "archive" ) {
                this.dirFiles.unshift( parentFile );
            } else if ( parentFile && parentFile.fullname !== file.fullname ) {
                parentFile.name = "..";
                this.dirFiles.unshift( parentFile );
            }
        } catch ( e ) {
            log.error( "PARENT DIR READ FAILED %s", e.stack );
        }
        this.colorUpdate();
        this.sort();
        log.info( "FIND LIST: %s", JSON.stringify(this.dirFiles.map((item) => `${item.attr} [${item.fullname}] [${item.name}]`), null, 2) );
        
        if ( previousDir ) {
            // search directory
            const befPos = this.dirFiles.findIndex( (file: File) => {
                // log.debug( "file.fullname: [%s]", file.fullname );
                return file.fullname === previousDir.fullname;
            });
            log.debug( "BEFORE DIR: %s, befPos: %d", previousDir.fullname, befPos );
            if ( befPos > -1 ) {
                this.currentPos = befPos;
            }
            this._previousDir = previousDir;
        }
        if ( !option || option.isNoSaveHistory !== true ) {
            log.warn( "DIR HISTORY ADD !!!", this._currentDir.fullname );
            this.dirHistory.add( this._currentDir );
        }
    }

    filter( _file: File ): boolean {
        return true;
    }

    colorUpdate() {
        this.dirFiles.forEach( item => item.convertColor() );
    }

    async refreshPromise(): Promise<void> {
        await this.read( this.currentPath() || "." );
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

    @Help(T("Help.ToggleSelect"))
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

        for ( const i in this.dirFiles ) {
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
        const selectItems = this.dirFiles.filter( item => item.select );
        if ( selectItems.length > 0 ) {
            return selectItems;
        }
        if ( this.currentFile() && this.currentFile().name !== ".." ) {
            return [ this.currentFile() ];
        }
        return null;
    }

    @Help(T("Help.GotoHome"))
    async gotoHomePromise() {
        await this.read( await this.reader.homeDir() );
    }

    @Help(T("Help.GotoRoot"))
    async gotoRootPromise() {
        await this.read( await this.reader.rootDir() );
    }

    @Help(T("Help.GotoParent"))
    async gotoParentPromise() {
        await this.read( ".." );
    }

    @Help(T("Help.GotoBack"))
    async gotoBackPromise() {
        const prev = this.dirHistory.prev();
        if ( prev ) {
            log.warn( "HISTORY PREV [%s]", prev?.fullname );
            await this.read( prev, { isNoSaveHistory: true } );
        }
    }

    @Help(T("Help.GotoForward"))
    async gotoForwardPromise() {
        const next = this.dirHistory.next();
        if ( next ) {
            log.warn( "HISTORY NEXT [%s]", next?.fullname );
            await this.read( next, { isNoSaveHistory: true } );
        }
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
