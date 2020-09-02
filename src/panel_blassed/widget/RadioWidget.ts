import { Widgets } from "neo-blessed";
import { Widget } from "./Widget";
import { Logger } from "../../common/Logger";
import { ColorConfig } from "../../config/ColorConfig";
import { Color } from "src/common/Color";

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
            log.debug( "RadioWidget KEY: [%s] [%j]", ch, keyinfo );
            await this.listener(ch, keyinfo);
        });

        this.on("render", () => {
            this.afterRender();
        });
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
            const color = ColorConfig.instance().getBaseColor("radioA");
            const colorText = this.hasFocus() ? color.hexBlessReverseFormat(checkChar) : color.hexBlessFormat(checkChar);
            this.setContent( `[${colorText}] ${this.option.text}` );
        } else {
            const color = ColorConfig.instance().getBaseColor("radio_disable");
            const colorText = color.hexBlessFormat(`[${checkChar}]`) + " " + this.option.text;
            log.debug( colorText );
            this.setContent( colorText );
        }
    }

    afterRender() {
        if ( this.hasFocus() ) {
            this.moveCursor( 1, 0 );
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
        this.isChecked = !this.isChecked;
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
        super.destroy();
    }
}
