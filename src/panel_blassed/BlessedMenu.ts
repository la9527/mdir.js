import { BlessedProgram, Widgets, box, text, line, colors } from "neo-blessed";
import { Color } from '../common/Color';
import { ColorConfig } from '../config/ColorConfig';
import { ISubMenuConfig, menuConfig, IMainMenuConfig } from '../config/MenuConfig';
import { Widget } from './Widget';
import { sprintf } from "sprintf-js";
import { KeyMapping, KeyMappingInfo, keyHumanReadable } from "../config/KeyMapConfig";
import { Logger } from "../common/Logger";

const log = Logger("blessed-menu");

class BlassedMenuBox extends Widget {
    private menuBox = [];
    private menuColor: Color = ColorConfig.instance().getBaseColor("func");
    private menuAColor: Color = ColorConfig.instance().getBaseColor("funcA");
    private lineColor: Color = ColorConfig.instance().getBaseColor("menuLine");
    private menuItem = null;
    private selectPos = 0;

    constructor( opts: Widgets.BoxOptions | any ) {
        super( { ...opts, border: "line" } );
        this.selectPos = 0;
    }

    setMenu( menuItem: (ISubMenuConfig | string)[]) {
        this.menuItem = menuItem;
        this.selectPos = 0;

        this.menuBox.forEach( i => i.destroy() );
        this.menuBox = [];
    }

    draw() {
        this.menuBox.forEach( i => i.destroy() );
        this.menuBox = [];

        if ( !this.menuItem ) {
            return;
        }

        this.box.style = { ...this.menuColor.blessed, border: this.menuColor.blessed };
        let opt = { parent: this.box, left: 0, width: (this.width as number) - 2, height: 1 };
        this.menuItem.forEach( (item: string | ISubMenuConfig, i: number) => {
            let lineBox = null;
            if ( item === "-" ) {
                lineBox = line( { ...opt, type: "line", top: i, orientation: "horizontal", style: this.lineColor.blessed } );
            } else if ( (item as ISubMenuConfig).name ) {
                let content = null;
                let keyName = i !== this.selectPos ? 
                    this.menuAColor.fontHexBlessFormat(keyHumanReadable((item as ISubMenuConfig).key || "")) : 
                    keyHumanReadable((item as ISubMenuConfig).key || "");

                let style = i === this.selectPos ? this.menuColor.blessedReverse : this.menuColor.blessed;
                lineBox = text( { ...opt, top: i, content: (item as ISubMenuConfig).name + "{|}" + keyName, style, tags: true } );
            }
            this.menuBox.push( lineBox );
        });
        this.box.width = 30;
        this.box.height = this.menuBox.length + 2;
        log.debug( "menu draw: T:%d,L:%d,W:%d,H:%d", this.box.top, this.box.left, this.box.width, this.box.height );
    }

    keyUp() {
        do {
            this.selectPos--;
            if ( this.selectPos < 0 ) {
                this.selectPos = this.menuItem.length - 1;
            }
        } while( this.menuItem[this.selectPos] === "-" );
    }

    keyDown() {
        do {
            this.selectPos++;
            if ( this.selectPos >= this.menuItem.length ) {
                this.selectPos = 0;
            }
        } while( this.menuItem[this.selectPos] === "-" )
    }
}

@KeyMapping( KeyMappingInfo.Menu, "Menu" )
export class BlessedMenu {
    menuPos: number = 0;
    topMenu: Widget = null;
    menuColor: Color = null;
    menuAColor: Color = null;
    menuSelColor: Color = null;
    menuBox:BlassedMenuBox = null;
    menuConfig: IMainMenuConfig = null;

    constructor( opt: Widgets.BoxOptions | any ) {
        this.menuColor = ColorConfig.instance().getBaseColor("func");
        this.menuAColor = ColorConfig.instance().getBaseColor("funcA");
        this.menuSelColor = ColorConfig.instance().getBaseColor("funcSel");

        this.topMenu = new Widget( { ...opt, style: this.menuColor.blessed } );
        this.menuBox = new BlassedMenuBox( { ...opt, top: 1, width: 30, style: this.menuColor.blessed });

        this.topMenu.box.on("prerender", () => {
            this.draw();
            this.menuBox.draw();
        });
    }

    updateSubMenu() {
        let menuList = Object.keys(this.menuConfig);
        let name = menuList[this.menuPos];
        if ( name ) {
            this.menuBox.setMenu( this.menuConfig[name] );
        }
    }

    setMainMenuConfig( menuConfig: IMainMenuConfig ) {
        this.menuConfig = menuConfig;
        this.updateSubMenu();

        this.topMenu.setFront();
        this.menuBox.setFront();
    }

    setFocus() {
        this.topMenu.setFocus();
    }

    hasFocus(): boolean {
        return this.topMenu.hasFocus();
    }

    draw() {
        this.topMenu.top = 0;
        this.topMenu.left = 0;
        this.topMenu.width = "100%";
        this.topMenu.height = 1;

        let menuBoxPos = 4;
        let prefix = Array(menuBoxPos).join(" ");
        let viewText = Object.keys(this.menuConfig).map( (name, i) => {
            if ( i < this.menuPos )  {
                menuBoxPos += name.length + 2;
            }
            if ( i === this.menuPos ) {
                return " " + this.menuSelColor.hexBlessFormat(name) + " ";
            }
            return " " + this.menuAColor.fontHexBlessFormat(name.substr(0, 1)) + this.menuColor.fontHexBlessFormat(name.substr(1)) + " ";
        }).join("");

        log.debug( "%s", prefix + viewText );
        this.topMenu.setContentFormat( prefix + viewText );
        this.menuBox.left = menuBoxPos;
        this.menuBox.draw();
    }

    keyLeft() {
        this.menuPos--;
        if ( this.menuPos < 0 ) {
            this.menuPos = Object.keys(this.menuConfig).length - 1;
        }
        this.updateSubMenu();
    }

    keyRight() {
        this.menuPos++;
        if ( this.menuPos >= Object.keys(this.menuConfig).length ) {
            this.menuPos = 0;
        }
        this.updateSubMenu();
    }

    keyUp() {
        this.menuBox.keyUp();
    }

    keyDown() {
        this.menuBox.keyDown();
    }
}
