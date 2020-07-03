import { Widget } from "./Widget";
import { Widgets, text, input, button, form } from "neo-blessed";
import { strWidth } from "neo-blessed/lib/unicode";
import { ColorConfig } from "../../config/ColorConfig";
import { Logger } from '../../common/Logger';

const log = Logger("InputBox");

interface InputBoxOption {
    parent: Widget | Widgets.Screen,
    title: string;
    defaultText?: string;
    button: string[];
    result?: (text, button) => void;
}

const MIN_WIDTH = 50;
const MIN_HEIGHT = 14;
const MIN_BUTTON_WIDTH = 12;

export class InputBox extends Widget {
    private inputWidget: Widget = null;
    private titleWidget: Widget = null;
    private buttonWidgets: Widget[] = [];

    private promptText: string = "";
    private value: string = "";
    private cursorPos = 0;
    private keylock = false;

    private color = null;
    private inputColor = null;
    private btnColor = null;
    private focusBtnNum: number = -1;
    private buttonWidth = 0;

    private inputBoxOption: InputBoxOption = null;

    constructor( inputBoxOpts: InputBoxOption, opts: Widgets.BoxOptions ) {
        super( { parent: inputBoxOpts.parent, ...(opts || {}), top: "center", left: "center", width: MIN_WIDTH, height: MIN_HEIGHT, border: "line", clickable: true });

        this.inputBoxOption = inputBoxOpts;
        this.value = inputBoxOpts.defaultText || "";
        this.cursorPos = strWidth(this.value);

        const defaultColor = ColorConfig.instance().getBaseColor("mcd");
        this.box.style = defaultColor.blessed;

        this.on("keypress", async (ch, keyinfo) => {
            log.debug( "InputBox [%s] [%j]", ch, keyinfo );
            await this.listener(ch, keyinfo);
            log.debug( "InputBox text - [%s]", this.value );
            if ( !this.destroyed ) {
                this.afterRender();
                this.updateCursor();
            }
        });

        this.on("render", () => {
            log.debug( "AFTER RENDER" );
            this.afterRender();
            this.updateCursor();
        });

        this.on("detach", () => {
            log.debug( "detach !!!" );
            this.box.screen.program.hideCursor();
        });

        this.init();
    }

    setFocus() {
        super.setFocus();
    }

    updateCursor() {
        const program = this.box.screen.program;
        if ( this.focusBtnNum === -1 && program.cursorHidden ) {
            log.debug( "showCursor !!!");
            program.showCursor();
        } else if ( this.focusBtnNum > -1 && !program.cursorHidden ) {
            log.debug( "hideCursor !!!");
            program.hideCursor();
        }
    }

    resize() {
        const maxWidth = this.box.screen.width as number;
        this.buttonWidth = this.inputBoxOption.button.reduce( (pre, item) => pre < strWidth(item) + 2 ? strWidth(item) + 2 : pre, MIN_BUTTON_WIDTH);

        let buttonAllWidth = this.inputBoxOption.button.length * (this.buttonWidth + 2);
        
        let width = Math.min( Math.max(strWidth(this.inputBoxOption.title), buttonAllWidth), maxWidth );
        this.buttonWidth = Math.max(this.buttonWidth, MIN_BUTTON_WIDTH);

        this.box.width = Math.max( width, MIN_WIDTH);
        this.box.height = Math.min( 6 + this.inputBoxOption.button.length, MIN_HEIGHT);
        log.debug( "RESIZE - (%d, %d)", this.box.width, this.box.height );

        let len = this.inputBoxOption.button.length;
        this.buttonWidgets.map( (item, i) => {
            let left = (Math.floor((this.box.width as number) / (len+1)) * (i+1)) - Math.floor(this.buttonWidth / 2);
            item.bottom = 1;
            item.left = left;
            item.width = this.buttonWidth;
        });
    }

    init() {
        this.color = ColorConfig.instance().getBaseColor("dialog");
        this.inputColor = ColorConfig.instance().getBaseColor("input_box");
        this.btnColor = ColorConfig.instance().getBaseTwoColor("dialog", "func");

        this.box.style = { ...this.color.blessed, border: this.color.blessed };
        this.titleWidget = new Widget( { 
            parent: this, 
            top: 0, 
            width: "100%-2", 
            height: 1, 
            tags: true, 
            content: this.inputBoxOption.title, 
            style: this.color.blessedReverse, 
            align: "center" } );

        this.inputWidget = new Widget( { 
                parent: this, 
                top: 2, 
                left: "center",
                width: "100%-4",
                tags: false, 
                height: 1, 
                style: this.inputColor.blessed, 
                align: "left" 
            });

        const len = this.inputBoxOption.button.length;
        this.inputBoxOption.button.map( (item, i, arr) => {
            let left = (Math.floor((this.box.width as number) / (len+1)) * (i+1)) - Math.floor(this.buttonWidth / 2);
            this.buttonWidgets.push( 
                new Widget( {
                    parent: this, 
                    tags: true, 
                    content: item, 
                    left, 
                    align: "center",
                    clickable: true,
                    bottom: 1, 
                    height: 1, 
                    width: this.buttonWidth,
                    style: i === 0 ? this.btnColor.blessedReverse : this.btnColor.blessed
                })
            );
        });

        this.resize();
        this.setFocus();
    }

    draw() {
        this.resize();

        this.titleWidget.setContent( this.inputBoxOption.title );
        this.inputWidget.setContent( this.value );

        this.buttonWidgets.map( (i, n) => {
            i.box.style = (this.focusBtnNum === n ? this.btnColor.blessedReverse : this.btnColor.blessed);
            log.debug( "%d, %s %d", n, i.box.style, this.focusBtnNum );
        });
    }

    afterRender() {
        log.debug( "moveCursor : %d, %d", this.cursorPos, 0);
        this.inputWidget.moveCursor( this.cursorPos, 0 );
    }
    
    keyDown() {
        this.keyTab();
    }

    keyUp() {
        this.keyShiftTab();
    }

    keyLeft() {
        if ( this.focusBtnNum > -1 ) {
            return;
        }
        this.cursorPos = Math.max( 0, --this.cursorPos );
    }

    keyRight() {
        if ( this.focusBtnNum > -1 ) {
            return;
        }
        this.cursorPos = Math.min( strWidth(this.value), ++this.cursorPos );
    }

    keyReturn() {
        if ( this.focusBtnNum === -1 ) {
            this.keyTab();
            return;
        }
        this.inputBoxOption?.result(this.value, this.inputBoxOption.button[this.focusBtnNum] );
    }

    keyEscape() {
        this.inputBoxOption?.result(null, "cancel");
    }

    keyBackspace() {
        if ( this.focusBtnNum > -1 ) {
            return;
        }
        this.value = this.value.substr(0, this.cursorPos - 1) + this.value.substr(this.cursorPos);
        this.keyLeft();
        // log.debug( "BS - pos:[%d], this.value [%d]", this.cursorPos, this.value.length );
    }

    keyDelete() {
        if ( this.focusBtnNum > -1 ) {
            return;
        }
        // log.debug( "DEL - pos:%d", this.cursorPos );
        this.value = this.value.substr(0, this.cursorPos) + this.value.substr(this.cursorPos+1);
    }

    keyHome() {
        if ( this.focusBtnNum > -1 ) {
            return;
        }
        this.cursorPos = 0;
    }

    keyEnd() {
        if ( this.focusBtnNum > -1 ) {
            return;
        }
        this.cursorPos = strWidth(this.value);
    }

    keyTab() {  
        this.focusBtnNum++;
        if ( this.focusBtnNum >= this.buttonWidgets.length ) {
            this.focusBtnNum = -1;
        }
    }

    keyShiftTab() {
        this.focusBtnNum--;
        if ( this.focusBtnNum <= -1 ) {
            this.focusBtnNum = -1;
        }
    }

    async listener(ch, key) {
        if ( this.keylock ) {
            return;
        }
        this.keylock = true;
        const keyRelease = (render = false) => {
            if ( render ) {
                this.box?.screen.render();
            }
            this.keylock = false;
        };

        let camelize = (str) => {
            return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            }).replace(/\s+/g, "");
        };

        if ( key?.name ) {
            let methodName = camelize("key " + key.name);
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

        if ( this.focusBtnNum > -1 ) {
            keyRelease(true);
            return;
        }

        let value = this.value;
        if ( ch && !/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
            this.value = this.value.substr(0, this.cursorPos) + ch + this.value.substr(this.cursorPos);
            this.cursorPos += strWidth(ch);
        }
        keyRelease(true);
    }
}

export function inputBox( msgOpt: InputBoxOption, opts: Widgets.BoxOptions = {} ): Promise<string[]> {
    return new Promise(( resolve, reject ) => {
        const screen = msgOpt.parent.screen || opts.parent.screen;
        const input = new InputBox({
            parent: msgOpt.parent,
            title: msgOpt.title, 
            defaultText: msgOpt.defaultText, 
            button: msgOpt.button,
            result: (text, button) => {
                process.nextTick( () => {
                    input.destroy();
                    resolve( [ text, button ] );
                    screen.render();
                });
            }
        }, opts);
        screen.render();
    });
}
