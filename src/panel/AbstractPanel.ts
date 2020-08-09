import { Logger } from "../common/Logger";
import { File } from "../common/File";
import { SortType } from "../common/Sort";

const log = Logger("AbstractPanel");

export abstract class AbstractPanel {
    protected column: number = 0;
    protected row: number = 0;
    protected page: number = 0;
    
    protected sortType: SortType = SortType.COLOR;
    protected _sortReverse: boolean = false;
    protected sortOrder = [SortType.COLOR, SortType.NAME, SortType.EXT, SortType.SIZE];

    protected _currentPos: number = 0;
    protected dirFiles: File[] = [];
    protected _currentDir: File = null;
    protected _previousDir: File = null;

    get previousDir() {
        return this._previousDir;
    }

    resetPosition() {
        this.currentPos = 0;
    }

    keyLeft() {
        this.currentPos = this.currentPos < this.row ? 0 : this.currentPos - this.row;
    }

    keyRight() {
        let cur = this.currentPos + this.row;
        if ( cur > this.dirFiles.length - 1 ) {
            cur = this.dirFiles.length - 1;
        }
        this.currentPos = cur;
    }

    keyUp() {
        if ( this.currentPos > 0 ) {
            this.currentPos = this.currentPos - 1;
        }
    }

    keyDown() {
        if ( this.currentPos < this.dirFiles.length - 1 ) {
            this.currentPos = this.currentPos + 1;
        }
    }

    keyPageUp() {
        if ( this.currentPos < this.row * this.column ) {
            this.currentPos = 0;
        } else {
            this.currentPos = this.currentPos - (this.row * this.column);
        }
    }

    keyPageDown() {
        this.currentPos = this.currentPos + (this.row * this.column);
        if ( this.currentPos > this.dirFiles.length - 1 ) {
            this.currentPos = this.dirFiles.length - 1;
        }
    }

    keyHome() {
        this.currentPos = 0;
    }

    keyEnd() {
        this.currentPos = this.dirFiles.length - 1;
    }

    set currentPos(pos: number) {
        if ( pos >= this.dirFiles.length ) {
            pos = this.dirFiles.length - 1;
        }
        this._currentPos = pos;
        log.warn( "set currentPos: %d", pos );
        if ( this.column && this.row ) {
            this.page = Math.floor(this._currentPos / (this.column * this.row));
        }
    }
    get currentPos(): number {
        return this._currentPos;
    }

    abstract refreshPromise(): Promise<void>;

    sortChange() {
        this.sortType = (this.sortType + 1) % 5;

        switch ( this.sortType ) {
            case SortType.COLOR:
                this.sortOrder = [ SortType.COLOR, SortType.NAME, SortType.EXT, SortType.SIZE ];
                break;
            case SortType.NAME:
                this.sortOrder = [ SortType.NAME, SortType.EXT, SortType.COLOR, SortType.SIZE ];
                break;
            case SortType.EXT:
                this.sortOrder = [ SortType.EXT, SortType.NAME, SortType.COLOR, SortType.SIZE ];
                break;
            case SortType.SIZE:
                this.sortOrder = [ SortType.SIZE, SortType.NAME, SortType.COLOR, SortType.EXT ];
                break;
        }
    }

    sortReverse() {
        this._sortReverse = !this._sortReverse;
    }

    sort() {
        let fileSort = (isType: SortType, a: File, b: File): number => {
            if ( isType === SortType.COLOR ) {
                return b.color.number - a.color.number;
            }
            if ( isType === SortType.NAME ) {
                if ( a.name > b.name ) return 1;
                if ( b.name > a.name ) return -1;
                return 0;
            }
            if ( isType === SortType.EXT ) {
                if ( a.name > b.name ) return -1;
                if ( b.name > a.name ) return 1;
                return 0;
            }
            if ( isType === SortType.SIZE ) {
                return a.size - b.size;
            }
            if ( isType === SortType.TIME ) {
                return a.mtime.getTime() - b.mtime.getTime();
            }
            return 0;
        };

        this.dirFiles.sort( (a,b): number => {
            if ( a.dir && a.name === ".." ) {
                return -1;
            } else if ( a.dir && !b.dir ) {
                return -1;
            } else if ( !a.dir && b.dir ) {
                return 1;
            }
            return 0;
        });

        this.dirFiles.sort( (a,b): number => {
            if ( (a.dir && a.name === "..") || (b.dir && b.name === "..") ) {
                return 0;
            } else if ( a.dir && !b.dir ) {
                return 0;
            } else if ( !a.dir && b.dir ) {
                return 0;
            }

            for ( let order of this.sortOrder ) {
                const sortNum = this._sortReverse ? fileSort(order, b, a) : fileSort(order, a, b);
                if ( sortNum !== 0 ) {
                    return sortNum;
                }
            }
            return 0;
        });
    }
}
