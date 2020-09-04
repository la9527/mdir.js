import { Widgets, line, text } from "neo-blessed";
import { Widget } from "./Widget";

import { ColorConfig } from "../../config/ColorConfig";
import { Color } from "../../common/Color";
import { Logger } from "../../common/Logger";
import { File } from "../../common/File";
import { FileReader } from "../../panel/FileReader";

import { ConnectionListWidget } from "./ConnectionListWidget";
import { ButtonWidget } from "./ButtonWidget";
import { widgetsEventListener } from "./WidgetsEventListener";

import mainFrame from "../MainFrame";
import { IConnectionEditorOption, ConnectionEditor } from "./ConnectionEditor";
import * as fs from "fs";
import * as path from "path";

const log = Logger( "ConnectionWidget" );

export class ConnectionManager extends Widget {
    private titleWidget: Widget = null;
    private connectionListWidget: ConnectionListWidget = null;
    private color: Color = null;
    private elementsInfo: any[] = [];
    private eventElements: any[] = [];
    private fileReader = new FileReader();

    constructor( opts: Widgets.BoxOptions | any ) {
        super({
            ...(opts || {}),
            width: 76,
            height: 27,
            top: "center",
            left: "center",
            border: "line",
            clickable: true
        });
        this.init();
    }

    async init() {
        this.color = ColorConfig.instance().getBaseColor("dialog");
        this.box.style = { ...this.color.blessed, border: this.color.blessed };

        this.titleWidget = new Widget( { 
            parent: this, 
            top: 0, 
            width: "100%-2", 
            height: 1, 
            tags: true, 
            content: "SSH Connection Manager", 
            style: this.color.blessedReverse, 
            align: "center" } );

        const commonOption = {
            parent: this.box,
            tags: true,
            style: this.color.blessed
        };

        const labelTextOption = {
            ...commonOption,
            left: 3,
            width: 20,
            height: 1
        };

        const buttonOption = {
            ...commonOption,
            width: 20,
            height: 1
        };

        this.elementsInfo = [
            { top: 2, left: 2, width: 50, height: 20, type: "filelist", name: "filelist" },
            { top: 2, left: 53, type: "button", name: "insert", label: "Insert" },
            { top: 3, left: 53, type: "button", name: "modify", label: "Modify" },
            { top: 4, left: 53, type: "button", name: "remove", label: "Remove" },
            
            { top: 6, left: 53, type: "button", name: "mkdir", label: "Make Directory" },
            { top: 8, left: 53, type: "button", name: "jsonEditor", label: "JSON Editor" },
            
            { top: 23, left: 0, width: "100%-2", type: "line", orientation: "horizontal" },
            { top: 24, left: 53, type: "button", name: "close", label: "Close" }
        ];

        this.eventElements = [];
        this.elementsInfo.map( item => {
            if ( item.type === "button" ) {
                this.eventElements.push(new ButtonWidget({ ...buttonOption, top: item.top, left: item.left, width: item.width, aliasName: item.name, content: item.label }));
            } else if ( item.type === "line" ) {
                line({ ...commonOption, ...item });
            } else if ( item.type === "label" ) {
                text({ ...labelTextOption, ...item });
            } else if ( item.type === "filelist" ) {
                this.connectionListWidget = new ConnectionListWidget({ ...commonOption, top: item.top, left: item.left, width: item.width, height: item.height, aliasName: item.name, content: item.label }, this.fileReader);
                this.eventElements.push(this.connectionListWidget);
            }
        });

        widgetsEventListener( this.eventElements, (widget: Widget | any, index: number, eventName: string, args: any[] ) => {
            this.onEventListener( widget, index, eventName, args );
        });

        const connManagerPath = (await this.fileReader.homeDir()).fullname + "/.m/connection_manager";
        log.debug( "CONNECTION_MANAGER_PATH: " + connManagerPath );

        try {
            if ( !await this.fileReader.exist(connManagerPath) ) {
                log.debug( "CONNECTION_MANAGER_PATH: DIRECTORY CREATE - " + connManagerPath );
                await this.fileReader.mkdir( connManagerPath );
            }

            this.connectionListWidget.setBasePath( connManagerPath );
            await this.connectionListWidget.read( connManagerPath );
        } catch( e ) {
            log.error( e );
        }
        
        this.eventElements[0].setFocus();
        mainFrame().keyLock = true;
        this.box.screen.render();
    }

    destroy() {
        super.destroy();
        mainFrame().keyLock = false;
    }

    async refreshPromise() {
        await this.connectionListWidget.refreshPromise();
        this.eventElements[0].setFocus();
        this.box.screen.render();
    }

    getAliasWidget( name: string ) {
        return this.eventElements.find( (item: Widget) => item.aliasName === name );
    }

    onEventListener( widget: Widget, index, eventName, args: any[] ) {
        const firstUpperize = (str) => {
            return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toUpperCase() : word.toLowerCase();
            });
        };

        if ( eventName === "widget.return" ) {
            log.debug( "ConnectionManager.onClick" + firstUpperize(widget.aliasName) );
            if ( this["onClick" + firstUpperize(widget.aliasName) ] ) {
                this["onClick" + firstUpperize(widget.aliasName) ]();
                return;
            }
        }
        log.debug( "aliasName: %s, eventName: %s, args: %j", widget.aliasName, eventName, args );
    }

    onClickClose() {
        this.destroy();
        this.emit("widget.close");
    }

    onClickFilelist() {
        const file = this.connectionListWidget.currentFile();
        const data = this.getJsonFileLoad(file);
        log.debug( "emit widget.connect %j", data );
        this.destroy();
        this.emit("widget.connect", data );        
    }

    onClickInsert() {
        const connectionInfo: IConnectionEditorOption = {
            resultFunc: async (result: boolean, data ) => {
                process.nextTick( async () => {
                    if ( result ) {
                        const filePath = this.connectionListWidget.currentPath();
                        const fileName = filePath.fullname + path.sep + data.name + ".json";                    
                        fs.writeFileSync( fileName, JSON.stringify(data, null, 2), { encoding: "utf8" } );
                    }
                    await this.refreshPromise();
                });
            }
        };
        new ConnectionEditor(connectionInfo, { parent: this });
    }

    getJsonFileLoad( file: File ) {
        let option = null;
        try {
            const data = fs.readFileSync( file.fullname, { encoding: "utf8" } );
            option = JSON.parse(data);
        } catch( e ) {
            log.error( e );
            return null;
        }
        return option;
    }

    onClickModify() {
        const file = this.connectionListWidget.currentFile();

        const option = this.getJsonFileLoad(file);
        const connectionInfo: IConnectionEditorOption = {
            ...option,
            resultFunc: (result: boolean, data ) => {
                process.nextTick( async () => {
                    if ( result ) {
                        fs.writeFileSync( file.fullname, JSON.stringify(data, null, 2), { encoding: "utf8" } );

                        const filePath = this.connectionListWidget.currentPath();
                        const changeFileName = filePath.fullname + path.sep + data.name + ".json";
                        if ( changeFileName !== file.fullname ) {
                            fs.renameSync( file.fullname, changeFileName );
                        }   
                    }
                    await this.refreshPromise();
                });
            }
        };
        new ConnectionEditor(connectionInfo, { parent: this });
    }

    async onClickRemove() {
        const file = this.connectionListWidget.currentFile();        
        try {
            if ( file.dir ) {
                fs.rmdirSync( file.fullname );
            } else {
                fs.unlinkSync( file.fullname );
            }
        } catch( e ) {
            log.error( e );
        }
        await this.refreshPromise();
    }
}
