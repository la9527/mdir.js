import * as blessed from "neo-blessed";
import { Widgets } from "../../@types/blessed.d";
import { strWidth, charWidth } from "neo-blessed/lib/unicode";
import * as unicode from "neo-blessed/lib/unicode";
import { Widget } from "./widget/Widget";
import { Logger } from "../common/Logger";
import { StringUtils } from "../common/StringUtils";
import { ColorConfig } from "../config/ColorConfig";
import { Reader } from "../common/Reader";
import { KeyMapping, RefreshType, SearchDisallowKeys, Hint, Help, IHelpService } from '../config/KeyMapConfig';
import { KeyMappingInfo } from "../config/KeyMapConfig";
import { IBlessedView } from "./IBlessedView";
import { messageBox } from "./widget/MessageBox";
import { inputBox } from "./widget/InputBox";
import { T } from "../common/Translation";

import { Editor, IViewBuffer, EDIT_MODE } from '../editor/Editor';
import { Color } from "../common/Color";
import mainFrame from "./MainFrame";

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
    tailer: Widget = null;
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
            height: "100%-2"
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

        this.tailer = new Widget({
            parent: this.baseWidget,
            left: 0,
            top: "100%-1",
            width: "100%",
            height: 1,
            style: {
                bg: this.colorStat.back,
                fg: this.colorStat.font
            }
        });

        this.header.on("prerender", () => {
            log.debug( "header prerender !!! - Start %d", this.baseWidget._viewCount );
            this.header.setContent(this.title);
        });
        this.tailer.on("prerender", () => {
            log.debug( "tailer prerender !!! - Start %d", this.baseWidget._viewCount );
            let status1 = "";
            status1 = this.lastDoInfoLength !== this.doInfo.length ? "[Change]" : status1;
            status1 = this.isReadOnly ? "[Read Only]" : status1;

            let status2 = "";
            status2 = this.isDosMode ? "[DOS]" : status2;

            let status3 = this.isInsert ? "[Ins]" : "[Ovr]";
            status3 = this.editMode === EDIT_MODE.SELECT ? "[Select]" : status3;

            this.tailer.setContentFormat("          %-10s{|}Line: {bold}%-3d{/bold} Col: {bold}%-3d{/bold} %s%s", 
                status1, this.curLine, this.curColumn, status2, status3);
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

    setViewTitle( title ) {
        this.title = StringUtils.ellipsis( title, this.editor.width);
    }

    keyWrite( keyInfo ): RefreshType {
        if ( keyInfo && keyInfo.name !== "return" ) {
            let ch = keyInfo.sequence || keyInfo.ch;
            let chlen = charWidth( ch );
            log.debug( "keywrite : [%j] charlen [%d]", keyInfo, chlen );
            if ( chlen > 0 ) {
                this.inputData( ch );
            }
            return RefreshType.OBJECT;
        } else {
            log.debug( "NOT - pty write : [%j]", keyInfo );
        }
        return RefreshType.NONE;
    }

    postLoad(): void {
        // TODO: editor file highlight
    }
    postUpdateLines(line?: number, height?: number): void {
        // TODO: editor file highlight
    }

    inputBox(title: string, text: string, inputedText?: string): Promise<string[]> {
        return inputBox({
            parent: this.baseWidget.screen,
            title: title, 
            button: [ "OK" ],
            defaultText: inputedText
        });
    }
    
    messageBox(title: any, text: any, buttons?: string[]): Promise<string> {
        return messageBox({
            parent: this.baseWidget.screen,
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

        // log.debug( "[%d/%d] cursor : [%d] [%d] [%d] [%d]", this.line, this.column, this.curColumn, curX, curY, cursor );
        log.debug( "selected [1: %d/%d 2: %d/%d]", this.editSelect.x1, this.editSelect.y1, this.editSelect.x2, this.editSelect.y2 );

        for (let y = Math.max(yi, 0); y < yl; y++) {
            let line = screen.lines[y];
            if (!line) break;

            if (curY === y - yi && this.hasFocus() ) {
                cursor = xi + curX;
            } else {
                cursor = -1;
            }

            const bufferLine: IViewBuffer = this.viewBuffers[y - yi];
            //log.debug( "line : %d, [%d] [%s]", y - yi, bufferLine.viewLine, bufferLine.text );
            
            let tpos = 0;
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
                        fg: box.style.fg
                    }) | (8 << 18);
                }

                line[x][1] = ' ';
                if ( x - xi > -1 && bufferLine?.text && tpos < bufferLine.text.length ) {
                    if ( bufferLine.selectInfo ) {
                        const { all, start, end } = bufferLine.selectInfo;
                        let select = all;
                        if ( !select && tpos >= start ) {
                            if ( end === -1 || end >= tpos ) {
                                select = true;
                            }
                        }
                        if ( select ) {
                            line[x][0] = (box as any).sattr({
                                bold: false,
                                underline: false,
                                blink: false,
                                inverse: false,
                                invisible: false,
                                bg: box.style.bg,
                                fg: box.style.fg
                            }) | (8 << 18);
                        }
                    }
                    let ch = bufferLine.text[tpos++];
                    let chSize = unicode.strWidth( ch );
                    if (chSize === 0 ) {
                        ch = '';
                    } else {
                        line[x][1] = ch;
                        if ( chSize > 1 ) {
                            if ( ch === "\t" ) {
                                line[x][1] = ' ';
                            }
                            for ( let i = 1; i < chSize; i++ ) {
                                line[x+i][0] = (box as any).sattr({
                                    bold: false,
                                    underline: false,
                                    blink: false,
                                    inverse: false,
                                    invisible: false,
                                    bg: box.style.bg,
                                    fg: box.style.fg,
                                });
                                line[x+i][1] = ' ';
                            }
                            x += chSize - 1;
                        }
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

    async quitEditorPromise() {
        const result = await super.quitPromise();
        if ( result ) {
            await mainFrame().editorPromise(); // quit
        }
    }
}
