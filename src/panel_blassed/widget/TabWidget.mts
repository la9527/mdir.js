import { Widgets } from "neo-blessed";
import { Widget } from "./Widget.mjs";
import { Logger } from "../../common/Logger.mjs";
import { ColorConfig } from "../../config/ColorConfig.mjs";

const log = Logger("TabWidget");

export interface ITabWidgetOption {
    text?: string;
    defaultSelect?: boolean;
}

export class TabWidget extends Widget {
    private keylock: boolean = false;
    private cursorUpdateFunc = null;
    private select: boolean = false;
    private option: ITabWidgetOption = null;
    
    constructor( opts: Widgets.BoxOptions | any, option: ITabWidgetOption ) {
        super({
            tags: true, 
            align: "center",
            clickable: true,
            height: 1, 
            ...opts
        });
        this.option = option;
    
        this.on("keypress", async (ch, keyinfo) => {
            log.debug( "TabWidget [%s] KEY: [%s] [%j]", this.aliasName, ch, keyinfo );
            await this.listener(ch, keyinfo);
        });

        this.on( "widget.click", () => {
            this.setFocus();
            this.box.screen.render();
        });
        this.on( "widget.doubleclick", () => {
            this.emit( "widget.tabenter" );
        });

        this.cursorUpdateFunc = () => {
            this.curosrUpdate();
        };
        this.screen.on("render", this.cursorUpdateFunc);
        this.init();
    }

    init() {
        log.debug( "Init !!!" );
    }

    draw() {
        if ( this.disable ) {
            this.box.style = ColorConfig.instance().getBaseColor("button_disable").blessed;
        } else {
            const btnFocusColor = ColorConfig.instance().getBaseColor("buttonA");
            const btnSelectColor = ColorConfig.instance().getBaseColor("buttonS");
            const btnColor = ColorConfig.instance().getBaseColor("button");
            if ( this.hasFocus() ) {
                this.box.style = btnFocusColor.blessed;
            } else if ( this.hasSelect() ) {
                this.box.style = btnSelectColor.blessed;
            } else {
                this.box.style = btnColor.blessed;
            }
        }

        this.setContent( this.hasSelect() ? "[ " + this.option.text + " ]" : this.option.text );
    }

    curosrUpdate() {
        if ( this.hasFocus() ) {
            this.moveCursor( 4, 0 );
            const program = this.box.screen.program;
            if ( program.cursorHidden ) {
                log.info( "showCursor !!!");
                program.showCursor();
            }
        }
    }

    setFocus() {
        super.setFocus();
    }

    hasFocus() {
        return super.hasFocus();
    }

    setSelect( select: boolean ) {
        this.select = select;
    }

    hasSelect() {
        return this.select;
    }

    keyDown() {
        this.keyTab();
    }

    keyUp() {
        this.keyShiftTab();
    }

    keyLeft() {
        this.keyShiftTab();
    }

    keyRight() {
        this.keyTab();
    }

    keySpace() {
        this.keyReturn();
    }

    keyReturn() {
        this.emit( "widget.tabenter", this.select );
    }

    keyEscape() {
        this.emit("widget.escape");
    }

    keyTab() {  
        this.emit( "widget.tab" );
    }

    keyShiftTab() {
        this.emit( "widget.shifttab" );
    }

    async listener(ch, key) {
        if ( !this.hasFocus() ) {
            return;
        }

        if ( this.keylock ) {
            return;
        }
        this.keylock = true;
        const keyRelease = (render = false) => {
            if ( render && this.box ) {
                this.box.screen.render();
            }
            this.keylock = false;
        };

        const camelize = (str) => {
            return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            }).replace(/\s+/g, "");
        };

        if ( key && key.name ) {
            const methodName = camelize("key " + key.name);
            log.debug( "TabWidget.%s()", methodName );
            if ( this[methodName] ) {
                this[methodName]();
                keyRelease(true);
                return;
            } else if ( this[methodName + "Promise"] ) {
                await this[methodName + "Promise"]();
                keyRelease(true);
                return;
            }
        }
        if ( ["return", "enter"].indexOf(key.name) > -1 ) {
            // Fix for Windows OS (\r\n)
            keyRelease();
            return;
        }
        keyRelease(true);
    }

    destroy() {
        this.screen.removeListener( "render", this.cursorUpdateFunc);
        this.cursorUpdateFunc = null;
        super.destroy();
    }
}
