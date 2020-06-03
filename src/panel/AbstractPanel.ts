import { Logger } from "../common/Logger";
import { File } from "../common/File";
import { SortType } from "../common/Sort";

const log = Logger("main");

export abstract class AbstractPanel {
    protected column: number = 0;
    protected row: number = 0;
    protected page: number = 0;
    protected viewColumn: number = 0;

    protected sortType: SortType = SortType.COLOR;

    protected _currentPos: number = 0;
    protected dirFiles: File[] = [];
    protected _currentDir: File = null;
    protected _previousDir: File = null;

    get previousDir() {
        return this._previousDir;
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

    abstract refresh(): void;

    sort() {
        let fileSort = (isType: SortType, a: File, b: File): number => {
            if ( isType === SortType.COLOR ) {
                // log.debug( "SORT COLOR : %d %d", a.color.number, b.color.number );
                return b.color.number - a.color.number;
            }
            if ( isType === SortType.NAME ) {
                // log.debug( "SORT NAME : " );
                /* tslint:disable */
                if ( a.name > b.name ) return 1;
                if ( b.name > a.name ) return -1;
                /* tslint:enable */
                return 0;
            }
            if ( isType === SortType.EXT ) {
                // log.debug( "SORT EXT : " );
                /* tslint:disable */
                if ( a.name > b.name ) return -1;
                if ( b.name > a.name ) return 1;
                /* tslint:enable */
                return 0;
            }
            if ( isType === SortType.SIZE ) {
                // log.debug( "SORT SIZE : " );
                return a.size - b.size;
            }
            if ( isType === SortType.TIME ) {
                // log.debug( "SORT TIME : " );
                return a.mtime.getTime() - b.mtime.getTime();
            }
            return 0;
        };


        this.dirFiles = this.dirFiles.sort( (a,b): number => {
            if ( a.dir && a.name === ".." ) {
                return -1;
            } else if ( a.dir && !b.dir ) {
                return -1;
            } else if ( !a.dir && b.dir ) {
                return 1;
            }

            let sortOrder = [SortType.COLOR, SortType.NAME, SortType.EXT, SortType.SIZE];
            for ( let i = 0; i < sortOrder.length; i++ ) {
                let sortNum = fileSort(sortOrder[i], a,b);
                if ( sortNum !== 0 ) {
                    return sortNum;
                }
            }
            return 0;
        });
    }
}
