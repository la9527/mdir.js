import { Widget } from "./Widget";
import { Widgets } from "neo-blessed";
import { strWidth } from "neo-blessed/lib/unicode";
import { ColorConfig } from "../../config/ColorConfig";
import { Logger } from '../../common/Logger';

const log = Logger("InputBox");

interface InputBoxOption {
    title: string;
    defaultText: string;
    button: string[];
    result?: (text, button) => void;
}

export class InputBox extends Widget {
    private textWidget: Widget = null;
    private titleWidget: Widget = null;
    private buttonWidgets: Widget[] = [];

    private promptText: string = "";
    private value: string = "";
    private cursorPos = 0;
    private keylock = false;

    private color = null;
    private inputColor = null;
    private btnColor = null;
    private focusBtnNum: number = 0;
    private buttonWidth = 0;

    private inputBoxOption: InputBoxOption = null;

    constructor( inputBoxOpts: InputBoxOption, opts: Widgets.BoxOptions ) {
        super( { ...opts, top: "center", left: "center", width: "50%", height: "50%", border: "line", clickable: true });

        this.inputBoxOption = inputBoxOpts;
        this.value = inputBoxOpts.defaultText || "";
        this.cursorPos = this.value.length;

        const defaultColor = ColorConfig.instance().getBaseColor("mcd");
        this.box.style = defaultColor.blessed;

        this.on("keypress", async (ch, keyinfo) => {
            log.debug( "InputBox [%s] [%j]", ch, keyinfo );
            await this.listener(ch, keyinfo);
            log.debug( "InputBox text - [%s]", this.value );
        });
        this.on("detach", () => {
            log.debug( "detach !!!" );
            this.box.screen.program.hideCursor();
        });
        this.on("render", () => {
            this.afterRender();
            if ( this.box.screen.program.cursorHidden ) {
                this.box.screen.program.showCursor();
            }
        });
        this.init();
        this.setFocus();
    }

    init() {
        this.color = ColorConfig.instance().getBaseColor("dialog");
        this.inputColor = ColorConfig.instance().getBaseColor("input_box");
        this.btnColor = ColorConfig.instance().getBaseTwoColor("dialog", "func");

        log.debug( "this.color : %s", this.color);

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

        this.textWidget = new Widget( { 
                parent: this, 
                top: 2, 
                width: "100%-2",
                tags: false, 
                height: 1, 
                style: this.inputColor.blessed, 
                align: "left" 
            });

        this.inputBoxOption.button.map( (item, i, arr) => {
            let left = (Math.floor((this.box.width as number) / (arr.length+1)) * (i+1)) - Math.floor(this.buttonWidth / 2);
            this.buttonWidgets.push( 
                new Widget( {
                    parent: this, 
                    tags: true, 
                    content: "{center}" + item + "{/center}", 
                    left, 
                    clickable: true,
                    bottom: 1, 
                    height: 1, 
                    width: this.buttonWidth,
                    style: i === 0 ? this.btnColor.blessedReverse : this.btnColor.blessed
                })
            );
        });
    }

    resize() {
        const MIN_WIDTH = 50;
        const MAX_WIDTH = this.box.screen.width as number;

        const MIN_BUTTON_WIDTH = 12;
        this.buttonWidth = this.inputBoxOption.button.reduce( (pre, item) => pre < item.length + 2 ? item.length + 2 : pre, MIN_BUTTON_WIDTH);

        let buttonAllWidth = this.inputBoxOption.button.length * (this.buttonWidth + 2);
        
        let width = Math.min( Math.max(strWidth(this.inputBoxOption.title), buttonAllWidth), MAX_WIDTH );
        this.buttonWidth = Math.max(this.buttonWidth, 20);

        this.box.width = Math.max( width, MIN_WIDTH);
        this.box.height = Math.min( 6 + this.inputBoxOption.button.length, 14);
        log.debug( "RESIZE - (%d, %d)", this.box.width, this.box.height );

        let len = this.inputBoxOption.button.length;
        this.buttonWidgets.map( (item, i) => {
            let left = (Math.floor((this.box.width as number) / (len+1)) * (i+1)) - Math.floor(this.buttonWidth / 2);
            item.bottom = 1;
            item.left = left;
            item.width = this.buttonWidth;
        });
    }

    draw() {
        this.resize();

        this.titleWidget.setContent( this.inputBoxOption.title );
        this.textWidget.setContent( this.value );

        this.buttonWidgets.map( (i, n) => {
            i.box.style = (this.focusBtnNum === n ? this.btnColor.blessedReverse : this.btnColor.blessed);
            log.debug( "%d, %s %d", n, i.box.style, this.focusBtnNum );
        });
    }

    afterRender() {
        log.debug( "moveCursor : %d", this.cursorPos);
        this.textWidget.moveCursor( this.cursorPos, 0 );
    }

    setFocus() {
        super.setFocus();
        this.box.screen.program.showCursor();
        this.render();
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

    async keyReturnPromise() {
        this.inputBoxOption?.result(this.value, this.focusBtnNum === -1 ? 
            this.inputBoxOption.button[0] : this.inputBoxOption.button[this.focusBtnNum] );
    }

    keyEscape() {
        this.inputBoxOption?.result(null, "cancel");
    }

    keyBackspace() {
        log.debug( "BS - pos:%d", this.cursorPos );
        this.value = this.value.substr(0, this.cursorPos - 1) + this.value.substr(this.cursorPos);
        this.keyLeft();
    }

    keyDelete() {
        log.debug( "DEL - pos:%d", this.cursorPos );
        this.value = this.value.substr(0, this.cursorPos) + this.value.substr(this.cursorPos+1);
    }

    keyHome() {
        this.cursorPos = 0;
    }

    keyEnd() {
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
                this.box?.screen.render();
                this.keylock = false;
                return;
            } else if ( this[methodName + "Promise"] ) {
                await this[methodName + "Promise"]();
                this.box?.screen.render();
                this.keylock = false;
                return;
            }
        }

        if ( ["return", "enter"].indexOf(key.name) > -1 ) {
            // Fix for Windows OS (\r\n)
            this.keylock = false;
            return;
        }

        let value = this.value;
        if ( ch && !/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
            this.value = this.value.substr(0, this.cursorPos) + ch + this.value.substr(this.cursorPos);
            this.cursorPos += strWidth(ch);
        }
        if (this.value !== value) {
            this.box.screen.render();
        }
        this.keylock = false;
    }
}

export function inputBox( msgOpt: InputBoxOption, opts: Widgets.BoxOptions ): Promise<string[]> {
    return new Promise(( resolve, reject ) => {
        const input = new InputBox({
            title: msgOpt.title, 
            defaultText: msgOpt.defaultText, 
            button: msgOpt.button,
            result: (text, button) => {
                process.nextTick( () => {
                    input.destroy();
                    resolve( [ text, button ] );
                    opts.parent.screen.render();
                });
            }
        }, opts);
        opts.parent.screen.render();
    });
}
