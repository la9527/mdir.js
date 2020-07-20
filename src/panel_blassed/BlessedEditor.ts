import * as blessed from "neo-blessed";
import { Widgets } from "../../@types/blessed.d";
import { strWidth } from "neo-blessed/lib/unicode";
import { Panel } from "../panel/Panel";
import { Widget } from "./widget/Widget";
import { Logger } from "../common/Logger";
import { StringUtils } from "../common/StringUtils";
import { PanelFileBox } from "./PanelFileBox";
import { ColorConfig } from "../config/ColorConfig";
import { Reader } from "../common/Reader";
import { KeyMapping, RefreshType, SearchDisallowKeys, Hint, Help, IHelpService } from '../config/KeyMapConfig';
import { KeyMappingInfo } from "../config/KeyMapConfig";
import { IBlessedView } from "./IBlessedView";
import mainFrame from './MainFrame';
import { SearchFileBox } from './SearchFileBox';
import { File } from "../common/File";
import { messageBox } from "./widget/MessageBox";
import { inputBox } from "./widget/InputBox";
import { T } from "../common/Translation";
import * as FileType from "file-type";

import { Editor, IEditorBuffer } from "../editor/Editor";
import { Color } from "../common/Color";

const log = Logger( "BlassedEditor" );

@KeyMapping(KeyMappingInfo.Editor)
export class BlessedEditor extends Editor implements IBlessedView, IHelpService {

    colorEdit:Color = null;
    colorStat: Color = null;
    colorEditInfo: Color = null;
    colorEditInfoA: Color = null;

    baseWidget: Widget = null;
    editor: Widget = null;
    header: Widget = null;
    reader: Reader = null;

    constructor(opts: Widgets.BoxOptions | any, reader: Reader = null) {
        super();

        this.colorStat = ColorConfig.instance().getBaseColor("stat");
        this.colorEdit = ColorConfig.instance().getBaseColor("edit");
        this.colorEditInfo = ColorConfig.instance().getBaseColor("edit_info");
        this.colorEditInfoA = ColorConfig.instance().getBaseColor("edit_info_a");
        
        this.baseWidget = new Widget({ ...opts });
        this.reader = reader;

        this.editor = new Widget({
            parent: this.baseWidget,
            border: "line",
            left: 0,
            top: 1,
            width: "100%",
            height: "100%-1"
        });

        this.header = new Widget({
            parent: this.baseWidget,
            left: 0,
            top: 0,
            width: "100%",
            height: 1,
            style: {
                bg: this.colorStat.back,
                fg: this.colorStat.font
            }
        });

        this.editor.on("detach", () => {
            this.editor.box.screen.program.hideCursor();
        });
        this.editor.on("render", () => {
            if ( this.editor.screen.program.cursorHidden ) {
                this.editor.screen.program.showCursor();
            }
        });

        this.editor.on('resize', () => {
            process.nextTick(() => {
                this.column = this.editor.width as number - 2;
                this.line = this.editor.height as number - 2;
            });
        });

        (this.editor.box as any).render = () => {
            this._render();
        };
    }

    keyWrite( keyInfo ): RefreshType {
        if ( keyInfo && keyInfo.name !== "enter" && keyInfo ) {
            log.debug( "write : [%j]", keyInfo );
            this.inputData( keyInfo.sequence || keyInfo.ch );
            return RefreshType.OBJECT;
        } else {
            log.debug( "NOT - pty write : [%j]", keyInfo );
        }
        return RefreshType.NONE;
    }

    postLoad(): void {
        //
    }
    postUpdateLines(line?: number, height?: number): void {
        
    }

    inputBox(title: string, text: string, inputedText?: string): Promise<string[]> {
        return inputBox({
            parent: this.baseWidget,
            title: title, 
            button: [ "OK" ],
            defaultText: inputedText
        });
    }
    
    messageBox(title: any, text: any, buttons?: string[]): Promise<string> {
        return messageBox({
            parent: this.baseWidget,
            title: title, 
            msg: text,
            button: buttons
        });
    }

    setReader(reader: Reader) {
        this.reader = reader;
    }
    getReader(): Reader {
        return this.reader;
    }
    
    destroy() {
        super.destory();
        this.baseWidget.destroy();
        this.baseWidget = null;
    }
    
    getWidget(): Widget {
        return this.baseWidget;
    }
    
    setFocus() {
        this.baseWidget.setFocus();
    }
    
    hasFocus(): boolean {
        return this.baseWidget.hasFocus();
    }
    
    hide() {
        this.baseWidget.hide();
    }
    
    show() {
        this.baseWidget.show();
    }
    
    render() {
        this.baseWidget.render();
    }
    
    viewName(): string {
        return "Editor";
    }

    _cursorCheck() {
        let viewLines = this.viewBuffers.filter( item => item.textLine === this.curLine );
        
        let x = this.curColumn;
        let length = 0;
        let y = 0;
        let n = 0;
        for ( n = 0; n < viewLines.length; n++ ) {
            let strLen = strWidth(viewLines[n].text);
            length += strLen;
            if ( length >= this.curColumn ) {
                y = viewLines[n].viewLine;
                if ( viewLines[n].isNext && x === this.column ) {
                    y++;
                    x = 0;
                }
                break;
            }
            x -= strLen;
        }
        log.info( "cursor textlen [%d] width [%d] curColumn [%d] x [%d] y [%d] isNext [%s]", viewLines[n]?.text?.length, this.column, this.curColumn, x, y, viewLines[n]?.isNext );
        // x = strWidth(viewLines[n].text.substr(0, x));
        return { y, x };
    }

    _render(startRow = -1, endRow = -1) {
        const box: any = this.editor.box as Widgets.BoxElement;
        const screen = this.editor.screen as any;

        let ret = null;
        try {
            ret = (box as any)._render();
        } catch( e ) {
            log.error( e );
            return;
        }

        if (!ret) return;

        box.dattr = box.sattr(box.style);
      
        let xi = ret.xi + box.ileft
          , xl = ret.xl - box.iright 
          , yi = ret.yi + box.itop
          , yl = ret.yl - box.ibottom
          , cursor;

        this.line = box.height - 2;
        this.column = box.width - 2;
      
        this.screenMemSave( this.line, this.column );
        
        const { x: curX, y: curY } = this._cursorCheck();

        log.debug( "[%d/%d] cursor : [%d] [%d] [%d] [%d]", this.line, this.column, this.curColumn, curX, curY, cursor );
        
        for (let y = Math.max(yi, 0); y < yl; y++) {
            let line = screen.lines[y];
            if (!line) break;

            if (curY === y - yi && this.hasFocus() ) {
                cursor = xi + curX;
            } else {
                cursor = -1;
            }

            // log.debug( "line : %d, [%d] [%s]", y - yi, bufferLine.viewLine, bufferLine.text );
            
            for (let x = Math.max(xi, 0); x < xl; x++) {
                if (!line[x]) break;

                line[x][0] = (box as any).sattr({
                    bold: false,
                    underline: false,
                    blink: false,
                    inverse: false,
                    invisible: false,
                    bg: box.style.bg,
                    fg: box.style.fg,
                });

                if (x === cursor) {
                    line[x][0] = (box as any).sattr({
                        bold: false,
                        underline: false,
                        blink: false,
                        inverse: false,
                        invisible: false,
                        bg: box.style.bg,
                        fg: box.style.fg,
                    }) | (8 << 18);
                }

                if ( x - xi > -1 ) {
                    const bufferLine: IEditorBuffer = this.viewBuffers[y - yi];
                    if ( bufferLine?.text && x - xi < bufferLine.text.length ) {
                        line[x][1] = bufferLine.text[x - xi] || ' ';
                    } else {
                        line[x][1] = ' ';
                    }
                }
            }

            line.dirty = true;
            screen.lines[y] = line;
        }

        if ( startRow !== -1 && endRow !== -1 ) {
            screen.draw(yi + startRow, yi + endRow);
        }
        return ret;
    }
}
