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
        let width = this.width as number;
        this.box.style = this.select ? this.mcdColor.blessedReverse : this.mcdColor.blessed;
        let content = "";
        if ( this.node.file.fullname === "/" ) {
            content = "/";
        } else {
            let name = this.node.file.name;
            let nameSize = this.box.strWidth(name);
            if ( nameSize < this.width ) {
                content = name;
                if ( this.node.subDir.length ) {
                    blessed.box( { parent: this.box, top: 0, left: nameSize, width: width - nameSize, height: 1, content: "─".repeat( width - nameSize ), bold: true, style: this.lineColor.blessed } )
                }
            } else {
                content = sprintf( `%-${width-1}.${width-1}s~`, name );
            }
        }
        this.setContent(content);
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

    viewDepthSize: number = 0;

    constructor(  opts: Widgets.BoxOptions | any ) {
        super();

        this.mcdColor = ColorConfig.instance().getBaseColor("mcd");
        this.lineColor = ColorConfig.instance().getBaseColor("mcd_line");
        this.mcdHighlightColor = ColorConfig.instance().getBaseColor("mcd_highlight");

        this.baseWidget = new Widget( { ...opts, border: "line", style: { ...this.mcdColor.blessed, border: this.lineColor.blessed } } );
        this.pathWidget = new Widget( { parent: this.baseWidget, top: "100%-1", left: 2, width: "40%", height: 1, style: { ...this.mcdColor.blessed, border: this.lineColor.blessed } } );
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
            const runningFunc = {
                down: "keyDownPromise",
                up: "keyUp",
                left: "keyLeft",
                right: "keyRightPromise",
                pageup: "keyPageUp",
                pagedown: "keyPageDown",
                home: "keyHome",
                end: "keyEnd",
                "=": { method: "subDirScanPromise", param: [ 0 ] },
                "+": { method: "subDirScanPromise", param: [ 1 ] },
                "-": "subDirRemove"
                //enter: "keyEnterPromise",
                //return: "keyReturn"
            };

            const keyName = keyInfo.name || keyInfo.full;
            const obj = runningFunc[keyName];            
            if ( obj ) {
                let method = obj;
                let param = null;
                if ( typeof( obj ) === "object" ) {
                    method = obj.method;
                    param = obj.param;
                }

                log.info( "keypress [%s] - method: %s(%s)", keyName, method, param ? param.join(",") : "" );

                if ( this[ method ] ) {
                    if ( /(p|P)romise/.exec(method) ) {
                        await this[method].apply(this, param);
                    } else {
                        this[method].apply(this, param);
                    }
                }
                this.baseWidget.parent.screen.render();
            } else {
                log.info( "keypress [%s] %j", keyName, keyInfo );
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
        let MCD_TEXT_SIZE = 12;
        let MAX_MCD_TEXT_SIZE = 40;
        let MIN_TEXT_SIZE_OF_WIDTH = 120;

        let MCD_BASE_COL_POS = [ 0, 4 ];
        
        let width: number = this.baseWidget.width as number;
        if ( width <= MIN_TEXT_SIZE_OF_WIDTH ) {
            MCD_TEXT_SIZE = 12;
        } else {
            MCD_TEXT_SIZE = MCD_TEXT_SIZE + Math.round( (width - MIN_TEXT_SIZE_OF_WIDTH) / (width / (MAX_MCD_TEXT_SIZE - MCD_TEXT_SIZE)) );
            if ( MCD_TEXT_SIZE > MAX_MCD_TEXT_SIZE ) {
                MCD_TEXT_SIZE = MAX_MCD_TEXT_SIZE;
            }
        }

        {
            let i = 4;
            do {
                i = i + (MCD_TEXT_SIZE + 2);
                MCD_BASE_COL_POS.push( i );
            } while( width >= i );
        }

        this.viewDepthSize = MCD_BASE_COL_POS.reduce( (viewDepthSize: number, col: number, i: number) => {
            if ( (this.baseWidget.width as number) - (MCD_TEXT_SIZE + 6) < col ) {
                viewDepthSize = i - 2;
            }
            return viewDepthSize;
        }, 0);

        log.debug( "MCD_TEXT_SIZE: %d, viewDepthSize: [%s], [%d]", MCD_TEXT_SIZE, MCD_BASE_COL_POS, this.viewDepthSize);

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
        if ( curDir.depth - this.scrollCol > this.viewDepthSize ) {
            this.scrollCol = curDir.depth - this.viewDepthSize;
        }
        if ( curDir.row - this.scrollRow < 0 ) {
            this.scrollRow = curDir.row;
        }
        if ( curDir.depth - this.scrollCol < 1 ) {
            this.scrollCol = curDir.depth - 1;
            if ( this.scrollCol <= -1) {
                this.scrollCol = 0;
            }
        }

        log.debug( "%d, viewDepthSize: %d, scrollCol: %d", MCD_BASE_COL_POS.length, this.viewDepthSize, this.scrollCol );

        /*
        if (!_sStrSearch.empty())
        {
            setcol(_tMCDColor, pWin);
            mvwprintw(pWin, 0, width-25, "Search : [%-10s]", _sStrSearch.c_str());
        }
        */
        for ( let i = 0; i < this.arrOrder.length; i++ ) {
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
                for ( let t = this.scrollCol; t < col && t < this.scrollCol + this.viewDepthSize; t++ ) {
                    this.lines.push(
                        blessed.box( { parent: this.baseWidget.box, top: row - this.scrollRow, left: MCD_BASE_COL_POS[t - this.scrollCol + 1], width: 1, height : 1, content: arrayLineCh[t], style: this.lineColor.blessed } )
                    );
                }
            }

            if ( col - this.scrollCol > this.viewDepthSize ) continue;
            if ( this.scrollCol !== 0 && col - this.scrollCol < 1 ) continue;

            let dirButton: McdDirButton = new McdDirButton( { parent: this.baseWidget, width: MCD_TEXT_SIZE, height: 1 }, node );
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

        this.pathWidget.top = this.baseWidget.height as number - 2;
        this.pathWidget.left = 2;
        this.pathWidget.width = curDir.file.fullname.length + 9;
        this.pathWidget.setContentFormat( "Path [ %s ]", curDir.file.fullname );
    }

    afterRender() {
        log.debug("afterRender !!!");
    }

    resize() {

    }

    render() {
        this.baseWidget.render();
    }

    keyPageDown() {
        const node = this.getDirRowArea( this.currentDir().row + (this.baseWidget.box.height - 3), this.currentDir().depth, this.currentDir() );
        if ( node ) {
            this.curDirInx = node.index;
        }
    }

    keyPageUp() {
        const node = this.getDirRowArea( this.currentDir().row - (this.baseWidget.box.height + 3), this.currentDir().depth, this.currentDir() );
        if ( node ) {
            this.curDirInx = node.index;
        }
    }
}
