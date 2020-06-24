import * as blessed from "neo-blessed";
import { Widgets } from "neo-blessed";

import { Panel } from "../panel/Panel";
import { Widget } from "./widget/Widget";
import { Logger } from "../common/Logger";
import { StringUtils } from "../common/StringUtils";
import { PanelFileBox } from "./PanelFileBox";
import { ColorConfig } from "../config/ColorConfig";
import { Reader } from "../common/Reader";
import { KeyMapping, RefreshType, SearchDisallowKeys } from '../config/KeyMapConfig';
import { KeyMappingInfo } from "../config/KeyMapConfig";
import { IBlessedView } from "./IBlessedView";
import mainFrame from './MainFrame';
import { SearchFileBox } from './SearchFileBox';
import { File } from "../common/File";

const log = Logger("blessedpanel");

class SearchFileInfo {
    private _index = -1;
    private _files: File[] = [];

    constructor( files: File[] ) {
        this.files = files || [];
    }

    next() {
        this.index = this.index + 1;
        log.debug( "NEXT: %d/%d", this.index, this.files.length );
        return this.get();
    }

    get index() {
        return this._index;
    }

    set index( index ) {
        if ( index >= this._files.length ) {
            this._index = 0;
        } else if ( index < 0 ) {
            this._index = 0;
        } else {
            this._index = index;
        }
    }

    get files() {
        return this._files || [];
    }

    set files( files: File[] ) {
        if ( files && files.length ) {
            this._files = files || [];
            this._index = 0;
        } else {
            this._files = [];
            this._index = -1;
        }
    }

    get() {
        if ( this._files.length === 0 ) {
            return null;
        }
        return this._files[this.index];
    }
}

@KeyMapping( KeyMappingInfo.Panel, "Panel" )
export class BlessedPanel extends Panel implements IBlessedView {
    public fileBox: PanelFileBox[] = [];
    public baseWidget: Widget = null;
    public panel: Widget = null;
    public header: Widget = null;
    public tailer: Widget = null;
    public searchFileBox: SearchFileBox = null;
    
    protected viewColumn: number = 0;
    private _fileViewType = 0;
    private _lines = [];

    private _previousView = null;
    private _searchFiles: SearchFileInfo = null;

    private _isViewOwner = false;

    constructor( opts: Widgets.BoxOptions | any, reader: Reader = null ) {
        super( reader );
        const statColor = ColorConfig.instance().getBaseColor("stat");

        this.baseWidget = new Widget( { ...opts } );

        this.panel = new Widget({
            parent: this.baseWidget,
            border: "line",
            left: 0,
            top: 1,
            width: "100%",
            height: "100%-2"
        });

        this.header = new Widget({
            parent: this.baseWidget,
            left: 0,
            top: 0,
            width: "100%",
            height: 1,
            style: {
                bg: statColor.back,
                fg: statColor.font
            }
        });

        this.tailer = new Widget({
            parent: this.baseWidget,
            left: 0,
            top: "100%-1",
            width: "100%",
            height: 1,
            style: {
                bg: statColor.back,
                fg: statColor.font
            }
        });

        this.initRender();
    }

    getReader(): Reader {
        return this.reader;
    }

    setReader( reader: Reader ) {
        super.setReader( reader );
    }

    hide() {
        this.baseWidget.hide();
    }

    show() {
        this.baseWidget.show();
    }

    destroy() {
        log.debug( "PANEL - destroy()" );
        this.panel.destroy();
        this.header.destroy();
        this.tailer.destroy();
        this.baseWidget.destroy();
        this.baseWidget = null;
    }

    getWidget() {
        return this.baseWidget;
    }

    setFocus() {
        this.panel.setFocus();
    }

    hasFocus(): boolean {
        return this.panel.hasFocus();
    }

    initRender() {
        log.info( "initRender : fileBox.size : %d", this.fileBox.length );
        this.panel.on( "prerender", () => {
            let startTime = Date.now();
            log.debug( "Panel prerender !!! - Start %d", this.baseWidget._viewCount );
            this.resize();
            this.beforeRender();
            log.debug( "BlessedPanel prerender !!! - End %d - [%dms]", this.baseWidget._viewCount, Date.now() - startTime);
        });
        this.header.on( "prerender", () => {
            // log.debug( "header prerender !!! - Start %d", this.baseWidget._viewCount );
            if ( this._currentDir ) {
                this.header.setContent( this._currentDir.fullname );
            }
        });
        this.tailer.on( "prerender", () => {
            // log.debug( "tailer prerender !!! - Start %d", this.baseWidget._viewCount );
            if ( !this.dirFiles ) {
                return;
            }
            const dirSize = this.dirFiles.filter( i => i.dir ).length;
            const fileSize = this.dirFiles.filter( i => !i.dir ).length;
            const allFileSize = this.dirFiles.filter( i => !i.dir ).reduce((v, t) => v + t.size, 0);

            this.tailer.setContentFormat( "{bold}%5s{/bold} Files {bold}%5s{/bold} Dir {bold}%20s{/bold} Byte", 
                    StringUtils.toregular(fileSize), StringUtils.toregular(dirSize), StringUtils.toregular(allFileSize) );
        });
        
        this.baseWidget.on("detach", () => {
            log.debug( "panel detach !!! - %d", this.baseWidget._viewCount );
        });
    }

    async keyInputSearchFile(ch, keyInfo) {
        if ( !this.searchFileBox || !this.searchFileBox.value ) {
            const keyName = keyInfo.full || keyInfo.name;
            if ( SearchDisallowKeys.indexOf(keyName) > -1 ) {
                log.debug( "ignore key - [%s]", keyName );
                return false;
            }
        }

        if ( !this.searchFileBox ) {
            this.searchFileBox = new SearchFileBox( { parent: this.baseWidget } );
            this.searchFileBox.on("TAB_KEY", () => {
                this.searchFileTabKey();
            });
        }
        const result = await this.searchFileBox.executePromise(ch, keyInfo);
        if ( result && keyInfo?.name !== "tab" ) {
            this.searchFile();
        }
        if ( result ) {
            this.baseWidget.render();
        }
        return result;
    }

    async keyEnterPromise(): Promise<any> {
        this.searchFileBox?.clear();
        const result = await super.keyEnterPromise();
        if ( !result ) {
            const currentFile: File = this.dirFiles[this.currentPos];
            
            await mainFrame().commandRun( currentFile.fullname, true );
        }
        return RefreshType.ALL;
    }

    searchFile() {
        if ( !this.searchFileBox?.value ) {
            return;
        }
        const searchExp = new RegExp( this.searchFileBox?.value, "i" );
        this._searchFiles = new SearchFileInfo( this.dirFiles.filter( item => searchExp.test(item.name) ) );
        log.debug( "SEARCH FILES : [%j]", this._searchFiles.files.map( item => item.name ) );
        this.focusFile(this._searchFiles.get());
    }

    searchFileTabKey() {
        if ( this.searchFileBox.value ) {
            this.focusFile( this._searchFiles.next() );
        }
    }

    setViewColumn( column = 0 ) {
        this.viewColumn = column;
        return RefreshType.ALL;
    }

    resize() {
        const MAX_COLUMN = 6;

        const dirLength = this.dirFiles.length;
        const viewHeight = this.baseWidget.height as number - 2;
        if ( this.viewColumn === 0 || this.viewColumn > 6 ) {
            if ( dirLength <= this.baseWidget.height ) {
                this.column = 1;
            } else if ( dirLength <= (viewHeight * 2) ) {
                this.column = 2;
            } else if ( dirLength <= (viewHeight * 3) ) {
                this.column = 3;
            } else if ( dirLength <= (viewHeight * 4) ) {
                this.column = 4;
            } else if ( dirLength <= (viewHeight * 5) ) {
                this.column = 5;
            } else {
                this.column = 6;
            }
            const columnSize = Math.round(this.baseWidget.width as number / MAX_COLUMN);
            if ( this.column > columnSize ) {
                this.column = columnSize;
            }
        } else {
            this.column = this.viewColumn;
        }

        const row = Math.round((dirLength + this.column - 1) / this.column);
        if ( row <= (this.panel.height as number) - 2 ) {
            this.row = row;
        } else {
            this.row = this.panel.height as number - 2;
        }

        if ( this.column !== 0 && this.row !== 0 ) {
            this.page = Math.floor(this.currentPos / (this.column * this.row));
        }

        if ( this.isViewChange() ) {
            this.fileBox.map( item => {
                item.destroy();
            });
            this.fileBox = [];
            for ( let n = 0; n < this.column * this.row; n++ ) {
                this.fileBox.push( new PanelFileBox( { parent: this.panel as any, focusable: true }, this._fileViewType, this._isViewOwner ) );
            }
            log.info( "init Render : COL:%d, ROW:%d, PAGE:%d, currentPos:%d fileBoxLen: %d - viewHeight: %d", this.column, this.row, this.page, this.currentPos, this.fileBox.length, viewHeight );
        }
    }

    beforeRender() {
        log.info( "BlessedPanel beforeRender() - COL: %d, ROW: %d", this.column, this.row );

        if ( this.isViewChange() ) {
            let curPos = (this.column * this.row) * this.page;
            const itemWidth = Math.floor((this.baseWidget.width as number - (this.column * 2)) / this.column);

            this._lines.map( (item) => {
                item.destroy();
            });
            this._lines = [];

            let num = 0;
            for ( let col = 0; col < this.column; col++ ) {
                for ( let row = 0; row < this.row; row++ ) {
                    const fileBox = this.fileBox[num++];
                    fileBox.height = 1;
                    fileBox.width = itemWidth;
                    fileBox.top = row;
                    fileBox.left = col * (itemWidth + 2);
                    if ( curPos < this.dirFiles.length ) {
                        // log.debug( "SET_POS: %d, CUR_POS: %d", curPos, this.currentPos );
                        fileBox.setFile( this.dirFiles[curPos], (curPos === this.currentPos && this.panel.hasFocus()), curPos );
                    } else {
                        fileBox.setFile( null, false, -1 );
                    }
                    curPos++;
                }

                if ( col > 0 ) {
                    this._lines.push(blessed.line({
                                            parent: this.panel.box,
                                            orientation: "vertical",
                                            type: "bg",
                                            ch: "│",
                                            left: (col * (itemWidth + 2)) - 1,
                                            top: 0,
                                            height: "100%-2"
                                        }));
                }
            }
            log.info( "FileBox: CUR: %d SIZE: %d", this.currentPos, this.fileBox.length );
        } else {
            this.fileBox.forEach( item => {
                if ( item.getPosNo() === this.currentPos ) {
                    item.setFileFocus(this.panel.hasFocus());
                    item.render();
                } else if ( this._previousView && item.getPosNo() === this._previousView.currentPos ) {
                    item.setFileFocus(false);
                    item.render();
                }
            });
        }
        this._previousView = this.getCurrentView();
    }

    isViewChange() {
        const getMatchData = ( data ) => {
            let result = { ...data };
            delete result.currentPos;
            return JSON.stringify(result);
        };
        return !(this._previousView && getMatchData( this.getCurrentView() ) === getMatchData( this._previousView ));
    }

    getCurrentView() {
        return {
            currentPath: this.currentPath().fullname,
            column: this.column, 
            row: this.row, 
            page: this.page, 
            currentPos: this.currentPos,
            fileBoxLength: this.fileBox.length,
            width: this.baseWidget.width,
            height: this.baseWidget.height
        };
    }

    resetViewCache() {
        this._previousView = null;
    }

    render() {
        if ( this.isViewChange() ) {
            this.baseWidget.render();
        } else {
            this.resize();
            this.beforeRender();
        }
    }

    commandBoxShow() {
        mainFrame().commandBoxShow();
    }

    async mkdirPromise() {
        return await mainFrame().mkdirPromise();
    }

    async renamePromise() {
        return await mainFrame().renamePromise();
    }

    async consoleViewPromise() {
        await mainFrame().consoleViewPromise();
    }

    async sortChangePromise() {
        super.sortChange();
        await this.refreshPromise();
        return RefreshType.ALL;
    }

    async sortReversePromise() {
        super.sortReverse();
        await this.refreshPromise();
        return RefreshType.ALL;
    }

    async toggleExcludeHiddenFilePromise() {
        super.toggleExcludeHiddenFile();
        await this.refreshPromise();
        return RefreshType.ALL;
    }

    async viewResetPromise() {
        super.viewReset();
        this.viewColumn = 0;
        await this.refreshPromise();
        return RefreshType.ALL;
    }

    async viewOwnerPromise() {
        this._isViewOwner = !this._isViewOwner;
        await this.refreshPromise();
        return RefreshType.ALL;
    }
}
