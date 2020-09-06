import { Widgets } from "neo-blessed";
import { Widget } from "./Widget";
import { Logger } from "../../common/Logger";
import { ColorConfig } from "../../config/ColorConfig";

const log = Logger("ButtonWidget");

export class ButtonWidget extends Widget {
    private keylock: boolean = false;
    private cursorUpdateFunc = null;

    constructor( opts: Widgets.BoxOptions | any ) {
        super({
            tags: true, 
            align: "center",
            clickable: true,
            height: 1, 
            ...opts
        });

        this.on("keypress", async (ch, keyinfo) => {
            log.debug( "ButtonWidget [%s] KEY: [%s] [%j]", this.aliasName, ch, keyinfo );
            await this.listener(ch, keyinfo);
        });

        this.on( "widget.click", () => {
            this.setFocus();
            this.box.screen.render();
        });
        this.on( "widget.doubleclick", () => {
            this.emit( "widget.return" );
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
        const btnFocusColor = ColorConfig.instance().getBaseColor("buttonA");
        const btnColor = ColorConfig.instance().getBaseColor("button");
        this.box.style = this.hasFocus() ? btnFocusColor.blessed : btnColor.blessed;
    }

    curosrUpdate() {
        if ( this.hasFocus() ) {
            this.moveCursor( 0, 0 );
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

    keyReturn() {
        this.emit( "widget.return" );
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
            log.debug( "ButtonWidget.%s()", methodName );
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
