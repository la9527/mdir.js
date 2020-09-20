import { Widgets } from "neo-blessed";
import { Widget } from "./Widget";
import { Logger } from "../../common/Logger";
import { ColorConfig } from "../../config/ColorConfig";

const log = Logger("RadioWidget");

export interface IRadioWidgetOption {
    text?: string;
    isCheck?: boolean;
    defaultCheck?: boolean;
}

export class RadioWidget extends Widget {
    private keylock: boolean = false;
    private option: IRadioWidgetOption = null;
    private isChecked: boolean = false;
    private cursorUpdateFunc = null;

    constructor( opts: Widgets.BoxOptions | any, radioOption: IRadioWidgetOption ) {
        super({
            tags: true, 
            clickable: true,
            height: 1, 
            ...opts
        });
        this.option = radioOption;

        this.isChecked = this.option.defaultCheck || false;

        this.on("keypress", async (ch, keyinfo) => {
            log.debug( "RadioWidget [%s] KEY: [%s] [%j]", this.aliasName, ch, keyinfo );
            await this.listener(ch, keyinfo);
        });

        this.on( "widget.doubleclick", () => {
            this.keyReturn();
            this.box.screen.render();
        });

        this.on( "widget.click", () => {
            this.setFocus();
            this.box.screen.render();
        });

        this.cursorUpdateFunc = () => {
            this.curosrUpdate();
        };
        this.screen.on("render", this.cursorUpdateFunc);
        this.init();
    }

    setValue( isCheck: boolean ) {
        this.isChecked = isCheck;
    }

    getValue() {
        return this.isChecked;
    }

    init() {
        log.debug( "Init !!!" );
    }

    draw() {
        let checkChar = this.option.isCheck ? "V" : "*";
        checkChar = this.isChecked ? checkChar : " ";

        if ( !this.disable ) {
            const dialogColor = ColorConfig.instance().getBaseColor("dialog");
            this.box.style = dialogColor.blessed;

            const color = ColorConfig.instance().getBaseColor("radioA");
            const colorText = this.hasFocus() ? color.blessReverseFormat(checkChar) : color.blessFormat(checkChar);
            this.setContent( `[${colorText}] ${this.option.text}` );
            
        } else {
            this.box.style = ColorConfig.instance().getBaseColor("radio_disable").blessed;
            this.setContent( `[${checkChar}] ${this.option.text}` );
        }
    }

    curosrUpdate() {
        if ( this.hasFocus() ) {
            this.moveCursor( 1, 0 );
            const program = this.box.screen.program;
            if ( program.cursorHidden ) {
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

    keySpace() {
        this.keyReturn();
    }

    keyReturn() {
        this.emit("widget.changeradio", this.isChecked);
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
