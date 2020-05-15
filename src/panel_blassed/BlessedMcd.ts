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

    setDir( node: Dir, showCheck: boolean ) {
        this.node = node;
        this.showCheck = showCheck;
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

        this.searchWidget = new Widget( { parent: this.baseWidget, top: 1, left: "100%-25", width: 25, style: this.mcdColor.blessed } );
        this.pathWidget = new Widget( { parent: this.baseWidget, top: "100%-1", left: 2, style: this.mcdColor.blessed } );
        this.initReader();
    }

    setFocus() {
        this.baseWidget.setFocus();
    }

    hasFocus(): boolean {
        return this.baseWidget.hasFocus();
    }

    initRender() {
        this.baseWidget.on( "prerender", () => {
            log.debug( "BlessedPanel prerender !!!");

            this.resize();
            this.beforeRender();
        });
        this.baseWidget.on( "render", () => {
            this.afterRender();
        });
        this.render();
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
        
        if (this.arrOrder.length != this.buttonList.length) {
            this.buttonList.map( i => i.destroy() );
            this.buttonList = [];
            this.arrOrder.map( item => {
                this.buttonList.push( new McdDirButton( { width: 12, heigh: 1 }, item ) );
            });
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
       
        let buttonCount = 0;
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

            if ( node.depth !== 0 && node.parentDir.subDir[node.parentDir.subDir.length - 1] === node ) {
                arrayLineCh[col - 1] = ' ';
            }

            if ( row - this.scrollRow > height - 3 ) {
                break;
            }
            if ( row - this.scrollRow < 0 ) continue;

            if ( node === this.rootDir && node.parentDir.subDir[0] !== node ) {
                for ( let t = this.scrollCol; t < col && t < this.scrollCol + this.rowSize; t++ ) {
                    this.lines.push(
                        blessed.box( { parent: this.baseWidget.box, left: row - this.scrollRow + 1, top: MCD_BASE_COL_POS[t - this.scrollCol + 1], width: 1, height : 1, content: arrayLineCh[t], style: this.lineColor.blessed } )
                    );
                }
            }

            if ( col - this.scrollCol > this.rowSize ) continue;
            if ( this.scrollCol !== 0 && col - this.scrollCol < 1 ) continue;

            let dirButton: McdDirButton = this.buttonList[buttonCount];
            dirButton.height = 1;
            dirButton.width = 12;

            if ( node.depth === 0 ) {                
                dirButton.left = row - this.scrollRow + 1;
                dirButton.top = 1;
            } else {
                const opts = { parent: this.baseWidget.box, top: row - this.scrollRow, left: MCD_BASE_COL_POS[col-this.scrollCol], width: 1, height : 1, style: this.lineColor.blessed };                 
                if ( node.parentDir.subDir.length > 1 ) {
                    if ( node.parentDir.subDir[0] === node ) {
                        this.lines.push(
                            blessed.box( { ...opts, top: opts.top + 1, content: '┬' } )
                        );
                    } else {
                        let content = node.parentDir.subDir[ node.parentDir.subDir.length - 1].index === node.index ? "└" : "├";
                        this.lines.push(
                            blessed.box( { ...opts, top: opts.top + 1, content } )
                        );
                    }
                } else {
                    this.lines.push(
                        blessed.box( { ...opts, top: opts.top + 1, content: '─' } )
                    );
                }

                this.lines.push(
                    blessed.box( { ...opts, top: opts.top + 2, content: node.check ? '+' : '─', style: this.mcdHighlightColor.blessed } )
                );

                dirButton.left = opts.left + 2;
                dirButton.top = opts.top + 1;
            }
            dirButton.setDir( node, node === curDir ? this.hasFocus() : false );
            dirButton.render();

            buttonCount++;
        }

        log.info( "beforeRender !!!" );
    }

    afterRender() {

    }

    resize() {

    }

    render() {
        this.baseWidget.render();
    }
}
