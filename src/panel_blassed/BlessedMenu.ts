import { BlessedProgram, Widgets, box, text, line, colors } from "neo-blessed";
import { Color } from '../common/Color';
import { ColorConfig } from '../config/ColorConfig';
import { ISubMenuConfig, menuConfig, IMainMenuConfig } from '../config/MenuConfig';
import { Widget } from './Widget';
import { sprintf } from "sprintf-js";
import { KeyMapping, KeyMappingInfo } from "../config/KeyMapConfig";
import { Logger } from "../common/Logger";

const log = Logger("blessed-menu");

class BlassedMenuBox extends Widget {
    private menuBox = [];
    private menuColor: Color = ColorConfig.instance().getBaseColor("func");
    private menuAColor: Color = ColorConfig.instance().getBaseColor("funcA");
    private lineColor: Color = ColorConfig.instance().getBaseColor("line");
    private menuItem = null;
    private selectPos = 0;

    constructor( opts: Widgets.BoxOptions | any ) {
        super( { ...opts, border: "line" } );
        this.selectPos = 0;
    }

    convertKeyName() {

    }

    setMenu( menuItem: (ISubMenuConfig | string)[]) {
        this.menuItem = menuItem;
        this.selectPos = 0;
    }

    draw() {
        this.menuBox.forEach( i => i.destroy() );
        this.menuBox = [];

        if ( !this.menuItem ) {
            return;
        }

        this.box.style = { ...this.menuColor.blessed, border: this.lineColor.blessedReverse };
        let opt = { parent: this.box, left: 0, width: (this.width as number) - 2, height: 1 };
        this.menuItem.forEach( (item: string | ISubMenuConfig, i: number) => {
            let lineBox = null;
            if ( item === "-" ) {
                lineBox = line( { ...opt, type: "line", top: i, orientation: "horizontal", style: this.menuColor.blessed } );
            } else if ( (item as ISubMenuConfig).name ) {
                let content = sprintf("%s{|}%s", (item as ISubMenuConfig).name, (item as ISubMenuConfig).key || "" );
                let style = i === this.selectPos ? this.menuColor.blessedReverse : this.menuColor.blessed;
                lineBox = text( { ...opt, top: i, content, style, tags: true } );
            }
            this.menuBox.push( lineBox );
        });
        this.box.width = 30;
        this.box.height = this.menuBox.length + 2;
        log.debug( "draw: %d", this.selectPos );
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

@KeyMapping( KeyMappingInfo.Menu )
export class BlessedMenu {
    menuPos: number = 0;
    topMenu: Widget = null;
    menuColor: Color = null;
    menuAColor: Color = null;
    menuBox:BlassedMenuBox = null;
    menuConfig: IMainMenuConfig = null;

    constructor( opt: Widgets.BoxOptions | any ) {
        this.menuColor = ColorConfig.instance().getBaseColor("func");
        this.menuAColor = ColorConfig.instance().getBaseColor("funcA");

        this.topMenu = new Widget(opt);
        this.menuBox = new BlassedMenuBox( { ...opt, width: 30, style: this.menuColor.blessed });

        this.topMenu.box.on("prerender", () => {
            this.draw();
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
    }

    draw() {
        this.topMenu.top = 0;
        this.topMenu.left = 0;
        this.topMenu.width = "100%";
        this.topMenu.height = 1;

        let menuBoxPos = 4;
        let prefix = Array(menuBoxPos).join(" ");
        let viewText = Object.keys(this.menuConfig).map( (name, i) => {
            let color = i !== this.menuPos ? this.menuAColor : this.menuAColor.reverse();
            if ( i < this.menuPos )  {
                menuBoxPos += name.length + 1;
            }
            return color.fontHexBlessFormat(name.substr(0, 1)) + color.fontHexBlessFormat(name.substr(1));
        }).join(" ");

        this.topMenu.setContentFormat( prefix + viewText );

        this.menuBox.left = menuBoxPos;
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
