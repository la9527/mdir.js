import { Widget } from "./widget/Widget";
import { Widgets } from "neo-blessed";
import { ColorConfig } from "../config/ColorConfig";
import { Logger } from "../common/Logger";

const log = Logger("BottomFilesBox");

export class SearchFileBox extends Widget {
    private viewText: string = "";
    private keylock = false;
    
    constructor( opts: Widgets.BoxOptions | any ) {
        super( { top: 1, right: 0, width: 22, height: 1, ...opts } );
        this.box.style = ColorConfig.instance().getBaseColor("line").blessed;
    }

    get value() {
        return this.viewText;
    }

    clear() {
        this.viewText = "";
        return true;
    }

    updateLastChar() {
        this.viewText = this.viewText.substr(this.viewText.length - 1);
    }

    draw() {
        if ( this.viewText ) {
            this.setContentFormat( "[%-20s]", this.viewText);
            this.show();
        } else {
            this.hide();
        }
    }

    keyEscape() {
        this.viewText = "";
        return true;
    }

    keyBackspace() {
        this.viewText = this.viewText.substr(0, this.viewText.length - 1);
        return true;
    }

    keyTab() {
        this.box.emit( "TAB_KEY" );
        return true;
    }

    async executePromise(ch, keyInfo): Promise<boolean> {
        if ( this.keylock ) {
            return false;
        }
        const viewText = this.viewText;
        this.keylock = true;
        const keyRelease = () => {
            if (this.viewText !== viewText) {
                this.box.screen.render();
            }
            this.keylock = false;
        };

        const camelize = (str) => {
            return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            }).replace(/\s+/g, "");
        };

        let result = false;
        if ( keyInfo && keyInfo.name ) {
            const methodName = camelize("key " + keyInfo.name);
            log.debug( "SearchFileBox.%s()", methodName );
            if ( this[methodName] ) {
                result = this[methodName]();
            } else if ( this[methodName + "Promise"] ) {
                result = await this[methodName + "Promise"]();
            }
            if ( result ) {
                keyRelease();
                return result;
            }
        }

        if ( ["return", "enter"].indexOf(keyInfo.name) > -1 ) {
            // Fix for Windows OS (\r\n)
            keyRelease();
            return false;
        }
        // eslint-disable-next-line no-control-regex
        if ( ch && !/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
            this.viewText += ch;
            result = true;
        }
        keyRelease();
        return result;
    }
}
