import * as blessed from "neo-blessed";
import { Widgets } from "neo-blessed";
import { sprintf } from "sprintf-js";

import { File } from "../common/File";
import { Reader } from "../common/Reader";
import { Mcd } from "../panel/Mcd";
import { Widget } from "./widget/Widget";
import { Dir } from "../common/Dir";
import { Color } from "../common/Color";
import { ColorConfig } from "../config/ColorConfig";
import { Logger } from "../common/Logger";
import { KeyMapping, IHelpService, RefreshType } from "../config/KeyMapConfig";
import { KeyMappingInfo } from "../config/KeyMapConfig";
import { IBlessedView } from "./IBlessedView";
import mainFrame from "./MainFrame";

const log = Logger("blessed-mcd");

class McdDirButton extends Widget {
    node: Dir;
    select: boolean;
    showCheck: boolean;

    mcdColor: Color;
    lineColor: Color;

    parentMcd: BlessedMcd;

    constructor( opts: Widgets.BoxOptions | any, node: Dir, parent: BlessedMcd ) {
        super(opts);

        this.mcdColor = ColorConfig.instance().getBaseColor("mcd");
        this.lineColor = ColorConfig.instance().getBaseColor("mcd_line");

        this.node = node;
        this.select = false;
        this.showCheck = false;
        this.parentMcd = parent;

        this.on("click", () => {
            this.parentMcd && this.parentMcd.onDirButtonClick(this);
        });
    }

    draw() {
        if ( !this.node ) {
            return;
        }
        const width = this.width as number;
        this.box.style = this.select ? this.mcdColor.blessedReverse : this.mcdColor.blessed;
        let content = "";
        const name = this.node.file.name;
        const nameSize: any = this.box.strWidth(name);
        if ( nameSize < this.width ) {
            content = name;
            if ( this.node.subDir.length ) {
                blessed.box( { parent: this.box, top: 0, left: nameSize, width: width - nameSize, height: 1, content: "─".repeat( width - nameSize ), style: this.lineColor.blessed } );
            }
        } else {
            content = sprintf( `%-${width-1}.${width-1}s~`, name );
        }
        content = "{bold}" + content + "{/bold}";
        this.setContent(content);
    }

    setDir( node: Dir, select: boolean ) {
        this.node = node;
        this.select = select;
        this.showCheck = true;
    }
}

@KeyMapping( KeyMappingInfo.Mcd )
export class BlessedMcd extends Mcd implements IBlessedView, IHelpService {
    buttonList: McdDirButton[] = [];
    lines: Widgets.BoxElement[] = [];

    mcdColor: Color;
    lineColor: Color;
    mcdHighlightColor: Color;
    
    baseWidget: Widget = null;
    mcdWidget: Widget = null;
    header: Widget = null;
    searchWidget: Widget = null;
    pathWidget: Widget = null;

    viewDepthSize: number = 0;

    firstScanPath: File = null;

    constructor(  opts: Widgets.BoxOptions | any, reader: Reader = null, firstScanPath = null ) {
        super( reader );

        this.firstScanPath = firstScanPath;
        const colorConfig = ColorConfig.instance();

        this.mcdColor = colorConfig.getBaseColor("mcd");
        this.lineColor = colorConfig.getBaseColor("mcd_line");
        this.lineColor = colorConfig.getBaseColor("mcd_line");
        this.mcdHighlightColor = colorConfig.getBaseColor("mcd_highlight");
        const statColor = colorConfig.getBaseColor("stat");
        
        this.baseWidget = new Widget( { ...opts } );
        this.mcdWidget = new Widget( { parent: this.baseWidget, top: 1, left: 0, height: "100%", width: "100%", border: "line", style: { ...this.mcdColor.blessed, border: this.lineColor.blessed } } );
        this.pathWidget = new Widget( { parent: this.baseWidget, top: "100%", left: 2, height: 1, style: { ...this.mcdColor.blessed, border: this.lineColor.blessed } } );
        this.header = new Widget({
            parent: this.baseWidget,
            left: 0,
            top: 0,
            type: "bg",
            width: "100%",
            height: 1,
            bg: statColor.back,
            style: {
                bg: statColor.back,
                fg: statColor.font
            }
        });
        this.initRender();
    }

    viewName() {
        return "Mcd";
    }

    setBoxDraw( _boxDraw: boolean ) {
        return true;
    }

    hasBoxDraw(): boolean {
        return true;
    }

    hide() {
        this.baseWidget.hide();
    }

    show() {
        this.baseWidget.show();
    }

    destroy() {
        log.debug( "MCD - destroy()" );
        this.baseWidget.destroy();
    }

    setReader( reader: Reader ) {
        super.setReader( reader );
    }

    getWidget() {
        return this.baseWidget;
    }

    setFocus() {
        this.baseWidget.setFocus();
    }

    hasFocus(): boolean {
        return this.baseWidget.hasFocus();
    }

    initRender() {
        this.baseWidget.on( "prerender", () => {
            log.debug( "BlessedMcd prerender - %d", this.baseWidget._viewCount );
            this.resize();
            this.beforeRender();
        });
        this.baseWidget.on( "render", () => {
            this.afterRender();
        });
        this.baseWidget.on("detach", () => {
            log.debug( "mcd detach !!! - %d", this.baseWidget._viewCount );
        });
    }

    beforeRender() {
        let MCD_TEXT_SIZE = 12;
        const MAX_MCD_TEXT_SIZE = 40;
        const MIN_TEXT_SIZE_OF_WIDTH = 120;
        const MCD_BASE_COL_POS = [ 0, 7 ];
        
        this.mcdWidget.height = this.baseWidget.height as number - 1;
        
        const width: number = this.mcdWidget.width as number;
        if ( width <= MIN_TEXT_SIZE_OF_WIDTH ) {
            MCD_TEXT_SIZE = 12;
        } else {
            MCD_TEXT_SIZE = MCD_TEXT_SIZE + Math.round( (width - MIN_TEXT_SIZE_OF_WIDTH) / (width / (MAX_MCD_TEXT_SIZE - MCD_TEXT_SIZE)) );
            if ( MCD_TEXT_SIZE > MAX_MCD_TEXT_SIZE ) {
                MCD_TEXT_SIZE = MAX_MCD_TEXT_SIZE;
            }
        }

        {
            let i = 7;
            do {
                i = i + (MCD_TEXT_SIZE + 2);
                MCD_BASE_COL_POS.push( i );
            } while( width >= i );
        }

        this.viewDepthSize = MCD_BASE_COL_POS.reduce( (viewDepthSize: number, col: number, i: number) => {
            if ( (this.mcdWidget.width as number) - (MCD_TEXT_SIZE + 6) < col ) {
                viewDepthSize = i - 2;
            }
            return viewDepthSize;
        }, 0);

        // log.debug( "MCD_TEXT_SIZE: %d, [%d]", MCD_TEXT_SIZE, this.viewDepthSize);

        this.lines.map( item => item.destroy() );
        this.lines = [];

        if (this.buttonList.length) {
            this.buttonList.map( i => i.destroy() );
            this.buttonList = [];
        }

        const arrayLineCh = [];
        let row = 0, col = 0, nODep = 0;
        const height = (this.mcdWidget.height as number);
        const curDir: Dir = this.currentDir();
        
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

        // if (!_sStrSearch.empty())
        // {
        //    setcol(_tMCDColor, pWin);
        //    mvwprintw(pWin, 0, width-25, "Search : [%-10s]", _sStrSearch.c_str());
        // }

        for ( const node of this.arrOrder ) {
            if ( nODep < node.depth ) {
                arrayLineCh.push( "│" );
            } else {
                while( node.depth < nODep ) {
                    nODep--;
                    arrayLineCh.pop();
                }
            }

            nODep = node.depth;
            col = node.depth;
            row = node.row;

            // log.info("nODep [%d] col [%d] row [%d] scrollRow [%d] scrollCol [%d]", nODep, col, row, this.scrollRow, this.scrollCol);
            // log.info("NCurses::Draw pNode->nDepth [%d]", node.depth);

            if ( node.index !== 0 && node.parentDir && node.parentDir.subDir[node.parentDir.subDir.length - 1].index === node.index ) {
                arrayLineCh[col - 1] = " ";
            }

            if ( row - this.scrollRow > height - 3 ) {
                break;
            }
            if ( row - this.scrollRow < 0 ) continue;

            if ( node.index !== this.rootDir.index && node.parentDir && node.parentDir.subDir[0].index !== node.index ) {
                for ( let t = this.scrollCol; t < col && t < this.scrollCol + this.viewDepthSize; t++ ) {
                    this.lines.push(
                        blessed.box( { parent: this.mcdWidget.box, top: row - this.scrollRow, left: MCD_BASE_COL_POS[t - this.scrollCol + 1], width: 1, height : 1, content: arrayLineCh[t], style: this.lineColor.blessed } )
                    );
                }
            }

            if ( col - this.scrollCol > this.viewDepthSize ) continue;
            if ( this.scrollCol !== 0 && col - this.scrollCol < 1 ) continue;

            const dirButton: McdDirButton = new McdDirButton( { parent: this.mcdWidget, width: MCD_TEXT_SIZE, height: 1 }, node, this );
            if ( node.depth === 0 ) {
                dirButton.left = row - this.scrollRow + 1;
                dirButton.top = 0;
            } else {
                const opts = { 
                    parent: this.mcdWidget.box, 
                    top: row - this.scrollRow, 
                    left: MCD_BASE_COL_POS[col-this.scrollCol], 
                    width: 1, 
                    height : 1, style: this.lineColor.blessed };
                if ( node.parentDir.subDir.length > 1 ) {
                    if ( node.parentDir.subDir[0].index === node.index ) {
                        this.lines.push(
                            blessed.box( { ...opts, content: "┬" } )
                        );
                    } else {
                        const content = node.parentDir.subDir[ node.parentDir.subDir.length - 1].index === node.index ? "└" : "├";
                        this.lines.push(
                            blessed.box( { ...opts, content } )
                        );
                    }
                } else {
                    this.lines.push(
                        blessed.box( { ...opts, content: "─" } )
                    );
                }

                this.lines.push(
                    blessed.box( { ...opts, left: opts.left + 1, content: node.check ? "─" : "+", style: node.check ? this.lineColor.blessed : this.mcdHighlightColor.blessed  } )
                );

                dirButton.left = opts.left + 2;
                dirButton.top = opts.top;
            }
            dirButton.setDir( node, node.index === curDir.index ? this.hasFocus() : false );
            //log.debug("dirButton : [%20s] row [%d] left [%d] top [%d]", dirButton.node.file.name, node.row, dirButton.left, dirButton.top );
            this.buttonList.push( dirButton );
        }

        this.header.width = this.baseWidget.width;
        log.debug("header : %d, %j", this.header.width, this.header.box.style );
        this.header.setContent( curDir.file.fullname );

        this.pathWidget.top = this.baseWidget.height as number - 1;
        this.pathWidget.left = 2;
        this.pathWidget.width = curDir.file.fullname.length + 9;
        this.pathWidget.setContentFormat( "Path [ {bold}%s{/bold} ]", curDir.file.fullname );
    }

    onDirButtonClick( button: McdDirButton ) {
        if ( button && button.node && button.node.index ) {
            this.curDirInx = button.node.index;
            mainFrame().execRefreshType( RefreshType.OBJECT );
        }
    }

    afterRender() {
        log.debug("afterRender !!!");
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    resize() {
        
    }

    render() {
        this.baseWidget.render();
    }

    keyPageDown() {
        const node = this.getDirRowArea( this.currentDir().row + (this.mcdWidget.box.height as number - 3), this.currentDir().depth, this.currentDir() );
        if ( node ) {
            this.curDirInx = node.index;
        }
    }

    keyPageUp() {
        const node = this.getDirRowArea( this.currentDir().row - (this.mcdWidget.box.height as number + 3), this.currentDir().depth, this.currentDir() );
        if ( node ) {
            this.curDirInx = node.index;
        }
    }

    async keyEnterPromise() {
        await mainFrame().mcdPromise(false);
    }

    async keyEscapePromise() {
        await mainFrame().mcdPromise(true);
    }
}
