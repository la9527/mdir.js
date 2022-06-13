import blessed from "neo-blessed";
const { text, line } = blessed;
import { Widgets } from "../../@types/blessed";
import { strWidth } from "neo-blessed/lib/unicode.js";
import { Color } from "../common/Color.mjs";
import { ColorConfig } from "../config/ColorConfig.mjs";
import { ISubMenuConfig, IMainMenuConfig } from "../config/MenuConfig.mjs";
import { Widget } from "./widget/Widget.mjs";
import { KeyMapping, KeyMappingInfo, keyHumanReadable, RefreshType, IHelpService } from "../config/KeyMapConfig.mjs";
import { Logger } from "../common/Logger.mjs";
import mainFrame from "./MainFrame.mjs";
import { T } from "../common/Translation.mjs";

const log = Logger("blessed-menu");

class BlassedMenuBox extends Widget {
    private menuBox = [];
    private menuColor: Color = ColorConfig.instance().getBaseColor("func");
    private menuAColor: Color = ColorConfig.instance().getBaseColor("funcA");
    private menuSelColor = ColorConfig.instance().getBaseColor("funcSel");
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
        const opt = { parent: this.box, left: 0, width: (this.width as number) - 2, height: 1 };
        let top = 0;
        this.menuItem.forEach( (item: string | ISubMenuConfig, i: number) => {
            let lineBox = null;
            if ( item === "-" ) {
                lineBox = line( { ...opt, type: "line", top: top++, orientation: "horizontal", style: this.lineColor.blessed } );
            } else if ( (item as ISubMenuConfig) && (item as ISubMenuConfig).name ) {
                log.debug( "SUBMENU: %s", item );

                const keyName = i !== this.selectPos ? 
                    this.menuAColor.fontBlessFormat(keyHumanReadable((item as ISubMenuConfig).key || "")) : 
                    keyHumanReadable((item as ISubMenuConfig).key || "");

                const style = i === this.selectPos ? this.menuSelColor.blessed : this.menuColor.blessed;
                lineBox = text( { ...opt, top: top++, content: " " + (item as ISubMenuConfig).name + "{|}" + keyName + " ", style, tags: true } );
                // log.debug( "SUBMENU: %s", (item as ISubMenuConfig).name );
            }
            if ( lineBox ) {
                this.menuBox.push( lineBox );
            }
        });
        this.box.width = 30;
        this.box.height = this.menuBox.length + 2;
        // log.debug( "menu draw: T:%d,L:%d,W:%d,H:%d", this.box.top, this.box.left, this.box.width, this.box.height );
    }

    keyUp() {
        do {
            this.selectPos--;
            if ( this.selectPos < 0 ) {
                this.selectPos = this.menuItem.length - 1;
            }
        } while( this.menuItem[this.selectPos] === "-" || !this.menuItem[this.selectPos] );
    }

    keyDown() {
        do {
            this.selectPos++;
            if ( this.selectPos >= this.menuItem.length ) {
                this.selectPos = 0;
            }
        } while( this.menuItem[this.selectPos] === "-" || !this.menuItem[this.selectPos] );
    }

    getFocusMenu(): ISubMenuConfig {
        return this.menuItem[this.selectPos];
    }
}

@KeyMapping( KeyMappingInfo.Menu )
export class BlessedMenu implements IHelpService {
    menuPos: number = 0;
    topMenu: Widget = null;
    menuColor: Color = null;
    menuAColor: Color = null;
    menuSelColor: Color = null;
    menuBox: BlassedMenuBox = null;
    menuConfig: IMainMenuConfig = null;
    opt = null;

    constructor( opt: Widgets.BoxOptions | any ) {
        this.menuColor = ColorConfig.instance().getBaseColor("func");
        this.menuAColor = ColorConfig.instance().getBaseColor("funcA");
        this.menuSelColor = ColorConfig.instance().getBaseColor("funcSel");
        this.opt = opt;
    }

    viewName() {
        return "Menu";
    }

    init() {
        this.close();

        this.topMenu = new Widget( { ...this.opt, style: this.menuColor.blessed } );
        this.menuBox = new BlassedMenuBox( { ...this.opt, top: 1, width: 30, style: this.menuColor.blessed });

        this.topMenu.on("prerender", () => {
            this.draw();
            this.menuBox.draw();
        });
    }

    updateSubMenu() {
        const menuList = Object.keys(this.menuConfig);
        const name = menuList[this.menuPos];
        if ( name ) {
            this.menuBox.setMenu( this.menuConfig[name] );
        }
    }

    setMainMenuConfig( menuConfig: IMainMenuConfig ) {
        this.menuConfig = menuConfig;
        this.updateSubMenu();

        this.draw();
        this.topMenu.setFront();
        this.menuBox.setFront();
    }

    setFocus() {
        this.topMenu && this.topMenu.setFocus();
    }

    hasFocus(): boolean {
        return this.topMenu && this.topMenu.hasFocus();
    }

    draw() {
        if ( !this.topMenu ) {
            return;
        }

        this.topMenu.top = 0;
        this.topMenu.left = 0;
        this.topMenu.width = "100%";
        this.topMenu.height = 1;

        let menuBoxPos = 4;
        const prefix = Array(menuBoxPos).join(" ");
        const viewText = Object.keys(this.menuConfig).map( (name, i) => {
            const nm = T("Menu." + name);
            if ( i < this.menuPos )  {
                menuBoxPos += strWidth(nm) + 2;
            }
            if ( i === this.menuPos ) {
                return " " + this.menuSelColor.blessFormat(nm) + " ";
            }
            return " " + this.menuAColor.fontBlessFormat(nm.substr(0, 1)) + this.menuColor.fontBlessFormat(nm.substr(1)) + " ";
        }).join("");
        this.menuBox.left = menuBoxPos;
        this.menuBox.draw();

        // log.debug( "%s", prefix + viewText );
        this.topMenu.setContentFormat( prefix + viewText );
    }

    async keyEnterPromise() {
        const menuInfo = this.menuBox.getFocusMenu();
        this.close();
        
        setTimeout( async () => { // timeout for focus
            const type = await mainFrame().methodRun( menuInfo.method, menuInfo.funcParam );
            if ( type !== RefreshType.NONE ) {
                mainFrame().execRefreshType( type );
            }
        }, 100);
        return RefreshType.ALL;
    }

    close() {
        if ( this.topMenu ) {
            this.topMenu.destroy();
            this.topMenu = null;
        }

        if ( this.menuBox ) {
            this.menuBox.destroy();
            this.menuBox = null;
        }
        return RefreshType.ALL;
    }

    keyLeft() {
        this.menuPos--;
        if ( this.menuPos < 0 ) {
            this.menuPos = Object.keys(this.menuConfig).length - 1;
        }
        this.updateSubMenu();
        return RefreshType.ALL;
    }

    keyRight() {
        this.menuPos++;
        if ( this.menuPos >= Object.keys(this.menuConfig).length ) {
            this.menuPos = 0;
        }
        this.updateSubMenu();
        return RefreshType.ALL;
    }

    keyUp() {
        this.menuBox.keyUp();
    }

    keyDown() {
        this.menuBox.keyDown();
    }

    render() {
        this.opt.parent.render();
    }
}
