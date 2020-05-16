import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors, line } from 'neo-blessed';
import { strWidth } from "neo-blessed/lib/unicode";
import { sprintf } from "sprintf-js";

import { File } from "../common/File";
import { Reader } from "../common/Reader";
import { BlessedPanel } from "./BlessedPanel";
import { Mcd } from "../panel/Mcd";
import { Widget } from './Widget';
import { Dir } from "../common/Dir";
import { Color } from '../common/Color';
import { ColorConfig } from "../config/ColorConfig";
import { Logger } from "../common/Logger";

const log = Logger("blessed-mcd");

const MCD_BASE_COL_POS = [ 0, 4, 18, 32, 46, 60, 74, 88, 102, 116, 130, 144, 158 ];

class McdDirButton extends Widget {
    node: Dir;
    select: boolean;
    showCheck: boolean;

    mcdColor: Color;
    lineColor: Color;

    constructor( opts: Widgets.BoxOptions | any, node: Dir ) {
        super(opts);

        this.mcdColor = ColorConfig.instance().getBaseColor("mcd");
        this.lineColor = ColorConfig.instance().getBaseColor("mcd_line");

        this.node = node;
        this.select = false;
        this.showCheck = false;
    }

    draw() {
        if ( !this.node ) {
            return;
        }

        // let viewText = sprintf(`%10s %10s %5s {${fontHex}-fg}%s %10s{/${fontHex}-fg}`, this._file.attr, date, time, textFileName, tailview);
        this.box.style = this.select ? this.mcdColor.blessedReverse : this.mcdColor.blessed;
        let content = "";
        if ( this.node.file.fullname === "/" ) {
            content = "/";
        } else {
            let name = this.node.file.name;
            let nameSize = this.box.strWidth(name);
            if ( nameSize <= 12 ) {            
                content = name + " " + (this.node.subDir.length ? "─".repeat( 12 - nameSize ) : "" );
            } else {
                content = sprintf( "%-11.11s~", name );
            }
        }
        this.box.setContent(content);
    }

    setDir( node: Dir, select: boolean ) {
        this.node = node;
        this.select = select;
        this.showCheck = true;
    }
}

export class BlessedMcd extends Mcd {
    buttonList: McdDirButton[] = [];
    lines: box[] = [];

    mcdColor: Color;
    lineColor: Color;
    mcdHighlightColor: Color;

    baseWidget: Widget = null;
    searchWidget: Widget = null;
    pathWidget: Widget = null;

    rowSize: number = 0;

    constructor(  opts: Widgets.BoxOptions | any ) {
        super();

        this.mcdColor = ColorConfig.instance().getBaseColor("mcd");
        this.lineColor = ColorConfig.instance().getBaseColor("mcd_line");
        this.mcdHighlightColor = ColorConfig.instance().getBaseColor("mcd_highlight");

        this.baseWidget = new Widget( { ...opts, border: "line" } );

        // this.searchWidget = new Widget( { parent: this.baseWidget, top: 0, left: "100%-30", width: 24, height: 1, style: this.mcdColor.blessed } );
        this.pathWidget = new Widget( { parent: this.baseWidget, top: "100%-1", left: 2, width: "40%", height: 1, style: this.mcdColor.blessed } );
        this.initRender();
    }

    setFocus() {
        this.baseWidget.setFocus();
    }

    hasFocus(): boolean {
        return this.baseWidget.hasFocus();
    }

    initRender() {
        this.baseWidget.on( "keypress", async (ch, keyInfo) => {
            log.info( "keypress 1 %j", keyInfo );
            const runningFunc = {
                down: "keyDownPromise",
                up: "keyUp",
                left: "keyLeft",
                right: "keyRightPromise",
                pageup: "keyPageUp",
                pagedown: "keyPageDown",
                home: "keyHome",
                end: "keyEnd",
                //enter: "keyEnterPromise",
                //return: "keyReturn"
            };
            if ( runningFunc[keyInfo.name] && this[ runningFunc[keyInfo.name] ] ) {
                const runFuncName = runningFunc[keyInfo.name];
                log.warn( "%s", runFuncName );
                if ( /(p|P)romise/.exec(runFuncName) ) {
                    await this[runFuncName]();
                } else {
                    this[runFuncName]();
                }
                this.baseWidget.parent.screen.render();
            }
        });

        this.baseWidget.on( "prerender", () => {
            log.debug( "BlessedMcd prerender !!!");

            this.resize();
            this.beforeRender();
        });
        this.baseWidget.on( "render", () => {
            this.afterRender();
        });
    }

    beforeRender() {
        this.rowSize = MCD_BASE_COL_POS.reduce( (rowNum: number, col: number, i: number) => {
            if ( (this.baseWidget.width as number) - 30 > col ) {
                rowNum = i;
            }
            return rowNum;
        }, 0);

        this.lines.map( item => item.destroy() );
        this.lines = [];

        if (this.buttonList.length) {
            this.buttonList.map( i => i.destroy() );
            this.buttonList = [];
        }

        let arrayLineCh = [];
        let row = 0, col = 0, nODep = 0, j = 0;
        let height = (this.baseWidget.height as number);
        let curDir: Dir = this.currentDir();
        
        if ( curDir.row - this.scrollRow > height - 3 ) {
            this.scrollRow = curDir.row - height + 3;
        }
        if ( curDir.depth - this.scrollCol > this.rowSize ) {
            this.scrollCol = curDir.depth - this.rowSize;
        }
        if ( curDir.row - this.scrollRow < 0 ) {
            this.scrollRow = curDir.row;
        }
        if ( curDir.depth - this.scrollCol < 1 && curDir.depth - 1 > -1 ) {
            this.scrollCol = curDir.depth - 1;
        }

        /*
        if (!_sStrSearch.empty())
        {
            setcol(_tMCDColor, pWin);
            mvwprintw(pWin, 0, width-25, "Search : [%-10s]", _sStrSearch.c_str());
        }
        */       
        this.pathWidget.setContentFormat( "Path [ %s ]", curDir.file.fullname );
       
        for ( var i = 0; i < this.arrOrder.length; i++ ) {
            let node: Dir = this.arrOrder[i];

            if ( nODep < node.depth ) {
                arrayLineCh.push( '│' );
            } else {
                while( node.depth < nODep ) {
                    nODep--;
                    arrayLineCh.pop();
                }
            }

            nODep = node.depth;
            col = node.depth;
            row = node.row;

            //log.info("nODep [%d] col [%d] row [%d] scrollRow [%d] scrollCol [%d]", nODep, col, row, this.scrollRow, this.scrollCol);
		    // log.info("NCurses::Draw pNode->nDepth [%d]", node.depth);

            if ( node.index !== 0 && node.parentDir && node.parentDir.subDir[node.parentDir.subDir.length - 1].index === node.index ) {
                arrayLineCh[col - 1] = ' ';
            }

            if ( row - this.scrollRow > height - 3 ) {
                break;
            }
            if ( row - this.scrollRow < 0 ) continue;

            if ( node.index !== this.rootDir.index && node.parentDir && node.parentDir.subDir[0].index !== node.index ) {
                for ( let t = this.scrollCol; t < col && t < this.scrollCol + this.rowSize; t++ ) {
                    this.lines.push(
                        blessed.box( { parent: this.baseWidget.box, top: row - this.scrollRow, left: MCD_BASE_COL_POS[t - this.scrollCol + 1], width: 1, height : 1, content: arrayLineCh[t], style: this.lineColor.blessed } )
                    );
                }
            }

            if ( col - this.scrollCol > this.rowSize ) continue;
            if ( this.scrollCol !== 0 && col - this.scrollCol < 1 ) continue;

            let dirButton: McdDirButton = new McdDirButton( { parent: this.baseWidget, width: 12, height: 1 }, node );
            if ( node.depth === 0 ) {
                dirButton.left = row - this.scrollRow + 1;
                dirButton.top = 0;
            } else {
                const opts = { 
                    parent: this.baseWidget.box, 
                    top: row - this.scrollRow, 
                    left: MCD_BASE_COL_POS[col-this.scrollCol], 
                    width: 1, 
                    height : 1, style: this.lineColor.blessed };
                if ( node.parentDir.subDir.length > 1 ) {
                    if ( node.parentDir.subDir[0].index === node.index ) {
                        this.lines.push(
                            blessed.box( { ...opts, content: '┬' } )
                        );
                    } else {
                        let content = node.parentDir.subDir[ node.parentDir.subDir.length - 1].index === node.index ? "└" : "├";
                        this.lines.push(
                            blessed.box( { ...opts, content } )
                        );
                    }
                } else {
                    this.lines.push(
                        blessed.box( { ...opts, content: '─' } )
                    );
                }

                this.lines.push(
                    blessed.box( { ...opts, left: opts.left + 1, content: node.check ? '─' : '+', style: node.check ? this.lineColor.blessed : this.mcdHighlightColor.blessed  } )
                );

                dirButton.left = opts.left + 2;
                dirButton.top = opts.top;
            }
            dirButton.setDir( node, node.index === curDir.index ? this.hasFocus() : false );
            //log.debug("dirButton : [%20s] row [%d] left [%d] top [%d]", dirButton.node.file.name, node.row, dirButton.left, dirButton.top );

            this.buttonList.push( dirButton );
        }

        log.info( "beforeRender !!!" );
    }

    afterRender() {
        log.info("afterRender !!!");
    }

    resize() {

    }

    render() {
        this.baseWidget.render();
    }
}
