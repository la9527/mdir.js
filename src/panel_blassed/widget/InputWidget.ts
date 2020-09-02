import { strWidth } from "neo-blessed/lib/unicode";
import { Widgets } from "neo-blessed";
import { Widget } from "./Widget";
import { Logger } from "../../common/Logger";
import { ColorConfig } from "../../config/ColorConfig";
import { StringUtils } from "../../common/StringUtils";

const log = Logger("InputWidget");

export interface IInputBoxOption {
    defaultText?: string;
    passwordType?: boolean;
}

export class InputWidget extends Widget {
    private cursorPos: number = 0;
    private viewCurPos: number = 0;
    private value: string = "";
    private keylock: boolean = false;
    private option: IInputBoxOption = null;
    
    constructor( opts: Widgets.BoxOptions | any, option: IInputBoxOption ) {
        super( opts );

        this.option = option;
        this.value = option.defaultText || "";
        this.cursorPos = strWidth(this.value);

        const inputboxColor = ColorConfig.instance().getBaseColor("input");
        this.box.style = this.disable ? inputboxColor.blessedReverse : inputboxColor.blessed;

        this.on("keypress", async (ch, keyinfo) => {
            log.debug( "InputBox [%s] [%j]", ch, keyinfo );
            await this.listener(ch, keyinfo);
            log.debug( "InputBox text - [%s]", this.value );
            if ( !this.destroyed ) {
                this.afterRender();
            }
        });

        this.on("render", () => {
            this.afterRender();
        });

        this.init();
    }

    init() {
        log.debug( "Init !!!" );
    }

    getValue() {
        return this.value;
    }

    setValue( value: string ) {
        this.value = value;
        this.cursorPos = strWidth(this.value);
    }

    draw() {
        const inputboxColor = ColorConfig.instance().getBaseColor("input");
        const inputDisableColor = ColorConfig.instance().getBaseColor("input_disable");
        this.box.style = this.disable ? inputDisableColor.blessed : inputboxColor.blessed;

        const width = this.box.width;
        const w = strWidth( this.value );
        let viewStr = this.value;
        if ( w > width ) {
            let cutFirstPos = this.cursorPos - 3;
            if ( cutFirstPos < 0) {
                cutFirstPos = 0;
            } else if ( w - cutFirstPos < width ) {
                cutFirstPos = w - (width as number);
            }            
            viewStr = StringUtils.scrSubstr( this.value, cutFirstPos, width as number );
            this.viewCurPos = this.cursorPos - cutFirstPos;
        } else {
            this.viewCurPos = this.cursorPos;
        }

        const passwordType = this.option && this.option.passwordType || false;
        this.setContent( passwordType ? viewStr.replace( /./g, "*" ) : viewStr );
    }

    setFocus() {
        super.setFocus();
    }

    hasFocus() {
        return super.hasFocus();
    }

    afterRender() {
        if ( this.hasFocus() ) {
            log.debug( "moveCursor : %d %d", this.viewCurPos, this.cursorPos);
            this.moveCursor( this.viewCurPos, 0 );
        }
    }

    keyDown() {
        this.keyTab();
    }

    keyUp() {
        this.keyShiftTab();
    }

    keyLeft() {
        this.cursorPos = Math.max( 0, --this.cursorPos );
    }

    keyRight() {
        this.cursorPos = Math.min( strWidth(this.value), ++this.cursorPos );
    }

    keyReturn() {
        this.emit( "widget.return" );
    }

    keyEscape() {
        this.emit("widget.escape");
    }

    keyBackspace() {
        this.value = StringUtils.scrSubstr( this.value, 0, this.cursorPos - 1) + StringUtils.scrSubstr( this.value, this.cursorPos );
        this.keyLeft();
        // log.debug( "BS - pos:[%d], this.value [%d]", this.cursorPos, this.value.length );
    }

    keyDelete() {
        // log.debug( "DEL - pos:%d", this.cursorPos );
        this.value = StringUtils.scrSubstr( this.value, 0, this.cursorPos) + StringUtils.scrSubstr( this.value, this.cursorPos + 1 );
    }

    keyHome() {
        this.cursorPos = 0;
    }

    keyEnd() {
        this.cursorPos = strWidth(this.value);
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
            log.debug( "InputBox.%s()", methodName );
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

        if ( !this.disable ) {
            // eslint-disable-next-line no-control-regex
            if ( ch && !/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
                this.value = StringUtils.scrSubstr( this.value, 0, this.cursorPos) + ch + StringUtils.scrSubstr( this.value, this.cursorPos );
                this.cursorPos += strWidth(ch);
            }
        }
        keyRelease(true);
    }

    destroy() {
        super.destroy();
    }
}
