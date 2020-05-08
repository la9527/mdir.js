import * as blessed from "neo-blessed";

import { Panel } from "../panel/Panel";
import { Widget } from "./Widget";
import { Logger } from "../common/Logger";
import { PanelFileBox } from "./PanelFileBox";

const log = Logger("blessedpanel");

export class BlessedPanel extends Panel {
    public fileBox: PanelFileBox[] = [];
    public panel: Widget = null;

    private _fileViewType = 0;
    private _lines = [];

    constructor( parentElement: any, widgetOption: any = {} ) {
        super();
        this.panel = new Widget({
            parent: parentElement,
            border: "line",
            left: 0,
            top: 2,
            width: "100%",
            height: "100%-4",
            ...widgetOption
        });

        this.initRender();
    }

    initRender() {
        log.info( "initRender : fileBox.size : %d", this.fileBox.length );

        this.panel.on( "keypress", async (ch, keyInfo) => {
            log.info( "keypress 1 %j", keyInfo );
            const runningFunc = {
                down: "keyDown",
                up: "keyUp",
                left: "keyLeft",
                right: "keyRight",
                pageup: "keyPageUp",
                pagedown: "keyPageDown",
                home: "keyHome",
                end: "keyEnd",
                enter: "keyEnterPromise",
                return: "keyReturn"
            };
            if ( runningFunc[keyInfo.name] && this[ runningFunc[keyInfo.name] ] ) {
                const runFuncName = runningFunc[keyInfo.name];
                log.warn( "%s", runFuncName );
                if ( /(p|P)romise/.exec(runFuncName) ) {
                    await this[runFuncName]();
                } else {
                    this[runFuncName]();
                }
                this.panel.parent.screen.render();
            }
        });
        this.panel.on( "prerender", () => {
            log.debug( "BlessedPanel prerender !!!");

            this.resize();
            this.beforeRender();
        });
        this.panel.on( "render", () => {
            this.afterRender();
        });
    }

    resize() {
        log.info("resize !!!");
        const MAX_COLUMN = 6;

        this.viewColumn = 0;

        const dirLength = this.dirFiles.length;
        const viewHeight = this.panel.height as number - 2;
        if ( this.viewColumn === 0 || this.viewColumn > 6 ) {
            if ( dirLength <= this.panel.height ) {
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
            const columnSize = Math.round(this.panel.width as number / MAX_COLUMN);
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

        this.fileBox.map( item => {
            item.destroy();
        });
        this.fileBox = [];
        for ( let n = 0; n < this.column * this.row; n++ ) {
            this.fileBox.push( new PanelFileBox( { parent: this.panel as any, focusable: true }, this, this._fileViewType ) );
        }
        log.info( "init Render : COL:%d, ROW:%d, PAGE:%d, currentPos:%d fileBoxLen: %d", this.column, this.row, this.page, this.currentPos, this.fileBox.length );
    }

    beforeRender() {
        log.info( "BlessedPanel beforeRender() - COL: %d, ROW: %d", this.column, this.row );

        if ( this.column !== 0 && this.row !== 0 ) {
            this.page = Math.floor(this.currentPos / (this.column * this.row));
        }
        let curPos = (this.column * this.row) * this.page;
        const itemWidth = Math.floor((this.panel.width as number - (this.column * 2)) / this.column);

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
                // fileBox.left = col * (fileBox.width + 2);
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
    }

    render() {
        log.info( "BlessedPanel.render()" );
        this.panel.render();
        log.info( "BlessedPanel.render() end..." );
    }

    afterRender() {
        log.info( "BlessedPanel.afterRender()" );
    }
}
