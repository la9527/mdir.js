/* eslint-disable prefer-const */
import { Widgets, text, line } from "neo-blessed";
import { Widget } from "./Widget";
import { widgetsEventListener } from "./WidgetsEventListener";
import { Logger } from "../../common/Logger";
import { ColorConfig } from "../../config/ColorConfig";
import { InputWidget } from "./InputWidget";
import { ButtonWidget } from "./ButtonWidget";
import { RadioWidget } from "./RadioWidget";
import { T } from "../../common/Translation";
import mainFrame from "../MainFrame";
import { TabWidget } from "./TabWidget";

const log = Logger("ConnectionManager");

export interface IConnectionInfoBase {
    protocol?: "SFTP" | "SSH" | "SFTP_SSH";
    host?: string;
    port?: number; // default 22
    username?: string;
    password?: string;
    privateKey?: string; // key file path
    proxyInfo?: {
        host?: string;
        port?: number;
        type?: 4 | 5;
        username?: string;
        password?: string;
    };
}

export interface IConnectionInfo {
    name?: string;
    info?: IConnectionInfoBase[];
}

export interface IConnectionEditorOption extends IConnectionInfo {    
    resultFunc: ( result: boolean, data: IConnectionInfo | any ) => void;
}

export class ConnectionEditor extends Widget {
    private titleWidget: Widget = null;
    private elementsInfo: any[] = [];
    private eventElements: Widget[] = [];
    
    private color = null;    
    private option: IConnectionEditorOption = null;

    private connectionInfoAliasNames = [   
        "host", "port", "username", "password", "privateKey", 
        "proxy", "proxy.host", "proxy.port", "proxy.type5", "proxy.type4", 
        "proxy.username", "proxy.password" ];

    constructor( option: IConnectionEditorOption, opts: Widgets.BoxOptions | any ) {
        super({
            ...(opts || {}),
            width: 70,
            height: 24,
            top: "center",
            left: "center",
            border: "line",
            clickable: true
        });
        this.option = option;
        if ( this.option && !this.option.info ) {
            this.option.info = [];
        }
        this.init();
    }

    init() {
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

        const inputOption = {
            ...commonOption,
            top: 2, 
            left: 25,
            width: 40,
            tags: false, 
            height: 1
        };

        const buttonOption = {
            ...commonOption,
            width: 20,
            height: 1
        };

        this.elementsInfo = [
            { top: 2, type: "input", name: "name", label: T("ConnectionManager.Name") },
            { top: 3, left: 0, width: "100%-2", type: "line", orientation: "horizontal" },

            { top: 4, left: 3, width: 20, type: "label", content: "Protocol" },
            { top: 4, left: 25, width: 14, type: "checkbox", name: "Protocol.DUAL", label: T("SFTP & SSH") },
            { top: 4, left: 43, width: 10, type: "checkbox", name: "Protocol.SFTP", label: T("SFTP") },
            { top: 4, left: 53, width: 10, type: "checkbox", name: "Protocol.SSH", label: T("SSH") },

            { top: 5, left: 0, width: "100%-2", type: "line", orientation: "horizontal" },

            { top: 6, left: 25, width: 20, type: "tab", name: "TAB.SFTP", label: T("SFTP"), default: false },
            { top: 6, left: 45, width: 20, type: "tab", name: "TAB.SSH", label: T("SSH"), default: false },
            
            { top: 8, type: "input", name: "host", label: T("ConnectionManager.Host") },
            { top: 9, type: "input", name: "port", label: T("ConnectionManager.Port") },
            { top: 10, type: "input", name: "username", label: T("ConnectionManager.Username") },
            { top: 11, type: "input", name: "password", label: T("ConnectionManager.Password"), passwordType: true },
            { top: 12, type: "input", name: "privateKey", label: T("ConnectionManager.PrivateKeyPath") },
            { top: 13, left: 0, width: "100%-2", type: "line", orientation: "horizontal" },
            { top: 14, left: 25, width: 20, type: "checkbox", name: "proxy", label: T("ConnectionManager.UseProxy") },
            { top: 15, type: "input", name: "proxy.host", label: T("ConnectionManager.ProxyHost") },
            { top: 16, type: "input", name: "proxy.port", label: T("ConnectionManager.ProxyPort") },
            { top: 17, left: 3, width: 20, type: "label", content: T("ConnectionManager.ProxyProtocol") },
            { top: 17, left: 25, width: 20, type: "radiobox", name: "proxy.type5", label: T("ConnectionManager.ProxyType5") },
            { top: 17, left: 40, width: 20, type: "radiobox", name: "proxy.type4", label: T("ConnectionManager.ProxyType4") },
            { top: 18, type: "input", name: "proxy.username", label: T("ConnectionManager.ProxyUsername") },
            { top: 19, type: "input", name: "proxy.password", label: T("ConnectionManager.ProxyPassword"), passwordType: true },
            { top: 20, left: 0, width: "100%-2", type: "line", orientation: "horizontal" },
            { top: 21, left: 10, width: 20, type: "button", name: "ok", label: T("Ok") },
            { top: 21, left: 40, width: 20, type: "button", name: "cancel", label: T("Cancel") }
        ];

        this.eventElements = [];
        this.elementsInfo.map( item => {
            if ( item.type === "input" ) {
                text({
                    ...labelTextOption,
                    top: item.top,
                    content: item.label
                });
                this.eventElements.push(new InputWidget({ ...inputOption, top: item.top, aliasName: item.name }, { defaultText: "" + (item.default || ""), passwordType: item.passwordType } ));
            } else if ( item.type === "button" ) {
                this.eventElements.push(new ButtonWidget({ ...buttonOption, top: item.top, left: item.left, width: item.width, aliasName: item.name, content: item.label }));
            } else if ( item.type === "tab" ) {
                this.eventElements.push(new TabWidget({ ...buttonOption, top: item.top, left: item.left, width: item.width, aliasName: item.name }, { text: item.label, defaultSelect: item.default } ));
            } else if ( item.type === "line" ) {
                line({ ...commonOption, ...item });
            } else if ( item.type === "label" ) {
                text({ ...labelTextOption, ...item });
            } else if ( [ "checkbox", "radiobox" ].indexOf(item.type) > -1 ) {
                this.eventElements.push(new RadioWidget(
                    { ...commonOption, top: item.top, left: item.left, width: item.width, aliasName: item.name, align: item.align }, 
                    { text: item.label, isCheck: item.type === "checkbox", defaultCheck: item.default || false }));
            }
        });

        this.on("focus", () => {
            this.eventElements[0].setFocus();
        });

        mainFrame().lockKey("connectionEditor", this);
        this.on("detach", () => {
            mainFrame().lockKeyRelease("connectionEditor");
        });

        widgetsEventListener( this.eventElements, (widget: Widget, index: number, eventName: string, args: any[] ) => {
            this.onEventListener( widget, index, eventName, args );
        });

        this.initInputData();
        this.initWidget();
        this.eventElements[0].setFocus();
        this.box.screen.render();
    }

    destroy() {
        this.eventElements.map( item => {
            item.destroy();
        });
        super.destroy();
    }

    getAliasWidget( name: string ) {
        return this.eventElements.find( (item: Widget) => item.aliasName === name );
    }

    initWidget() {
        const isProtocolDual = (this.getAliasWidget("Protocol.DUAL") as RadioWidget).getValue();
        const tabWidgets = this.eventElements.filter( (item: Widget) => item.aliasName.match( /^(Protocol|TAB)\.(SFTP|SSH)/ ) );
        tabWidgets.forEach( item => {
            item.disable = isProtocolDual;
            log.debug( "ALIAS: %s - isProtocolDual: %s DISABLE : %s", item.aliasName, isProtocolDual, item.disable );
        });
        if ( isProtocolDual ) {
            (this.getAliasWidget("TAB.SFTP") as TabWidget).setSelect( false );
            (this.getAliasWidget("TAB.SSH") as TabWidget).setSelect( false );
            (this.getAliasWidget("TAB.SFTP") as TabWidget).disable = true;
            (this.getAliasWidget("TAB.SSH") as TabWidget).disable = true;
        } else {
            (this.getAliasWidget("TAB.SFTP") as TabWidget).disable = false;
            (this.getAliasWidget("TAB.SSH") as TabWidget).disable = false;
        }

        const sftpWidget = (this.getAliasWidget("Protocol.SFTP") as RadioWidget);
        const sshWidget = (this.getAliasWidget("Protocol.SSH") as RadioWidget);
        const tabSftpWidget = (this.getAliasWidget("TAB.SFTP") as TabWidget);
        const tabSSHWidget = (this.getAliasWidget("TAB.SSH") as TabWidget);

        if ( !sftpWidget.disable ) {
            tabSftpWidget.disable = !sftpWidget.getValue();
            if ( tabSftpWidget.disable ) {
                tabSftpWidget.setSelect( false );
            }
        }        
        if ( !sshWidget.disable ) {
            tabSSHWidget.disable = !sshWidget.getValue();
            if ( tabSSHWidget.disable ) {
                tabSSHWidget.setSelect( false );
            }
        }

        const isProxy = (this.getAliasWidget("proxy") as RadioWidget).getValue();
        const proxyWidgets = this.eventElements.filter( (item: Widget) => item.aliasName.match( /^proxy\./ ) );
        proxyWidgets.forEach( item => {
            item.disable = !isProxy;
            // log.debug( "ALIAS: %s - isProxy: %s DISABLE : %s", item.aliasName, isProxy, item.disable );
        });

        const type4 = (this.getAliasWidget("proxy.type4") as RadioWidget);
        const type5 = (this.getAliasWidget("proxy.type5") as RadioWidget);
        if ( type4.getValue() === true ) {
            type4.setValue( true );
            type5.setValue( false );
        } else if ( type5.getValue() === true ) {
            type4.setValue( false );
            type5.setValue( true );
        }

        if ( !isProtocolDual && tabSftpWidget.disable && tabSSHWidget.disable ) {
            this.disableConnectionInfo(true);
        } else if ( !isProtocolDual && !tabSftpWidget.hasSelect() && !tabSSHWidget.hasSelect() ) {
            this.disableConnectionInfo(true);
        } else {
            this.disableConnectionInfo(false);
        }
    }

    onEventListener( widget: Widget, index, eventName, args: any[] ) {
        if ( eventName === "widget.return" ) {
            if ( [ "ok", "cancel" ].indexOf(widget.aliasName) > -1 ) {
                this.updateCurrentPositionInfo();
                const inputData = this.getInputData();
                this.destroy();
                if ( widget.aliasName === "ok" ) {
                    this.option.resultFunc( true, inputData );
                } else {
                    this.option.resultFunc( false, null );
                }
            }
            return;
        }
        if ( eventName === "widget.changeradio" ) {
            if ( [ "proxy.type5", "proxy.type4" ].indexOf(widget.aliasName) > -1 ) {
                (this.getAliasWidget("proxy.type4") as RadioWidget).setValue( widget.aliasName === "proxy.type4" );
                (this.getAliasWidget("proxy.type5") as RadioWidget).setValue( widget.aliasName === "proxy.type5" );
            } else if ( widget.aliasName === "proxy" ) {
                (widget as RadioWidget).setValue( !(widget as RadioWidget).getValue() );
                this.initWidget();
            } else if ( widget.aliasName.match( /^Protocol\./ ) ) {
                this.updateCurrentPositionInfo();
                (widget as RadioWidget).setValue( !(widget as RadioWidget).getValue() );

                if ( widget.aliasName === "Protocol.DUAL" ) {                     
                    if ( !(this.getAliasWidget("Protocol.DUAL") as RadioWidget).getValue() ) {
                        const infoFilter = this.option.info && this.option.info.filter( item => item.protocol.match( /(SFTP|SSH)/ ) );
                        if ( !infoFilter || infoFilter.length === 0 ) {
                            (this.getAliasWidget("TAB.SFTP") as TabWidget).setSelect( true );
                            (this.getAliasWidget("TAB.SSH") as TabWidget).setSelect( false );
                            this.setWidgetForConnectionInfo( null );
                        } else {
                            if ( infoFilter.length === 1 ) {
                                (this.getAliasWidget("TAB.SFTP") as TabWidget).setSelect( !!infoFilter.find( item => item.protocol === "SFTP" ) );
                                (this.getAliasWidget("TAB.SSH") as TabWidget).setSelect( !!infoFilter.find( item => item.protocol === "SSH" ) );
                                this.setWidgetForConnectionInfo( infoFilter[0] );
                            } else if ( infoFilter.length === 2 ) {
                                (this.getAliasWidget("TAB.SFTP") as TabWidget).setSelect( true );
                                (this.getAliasWidget("TAB.SSH") as TabWidget).setSelect( false );
                                this.setWidgetForConnectionInfo( infoFilter.find( item => item.protocol === "SFTP" ) );
                            }
                        }
                    } else if ( this.option.info && this.option.info.length > 0 ) {
                        const item = this.option.info.find( item => item.protocol === "SFTP_SSH" );
                        if ( item ) {
                            this.setWidgetForConnectionInfo( item );
                        }
                    }
                }
                this.initWidget();
            }
        }
        if ( eventName === "widget.tabenter" ) {
            this.updateCurrentPositionInfo();
            (widget as TabWidget).setSelect( !(widget as TabWidget).hasSelect() );
            if ( [ "TAB.SFTP", "TAB.SSH" ].indexOf(widget.aliasName) > -1 ) {
                (this.getAliasWidget("TAB.SFTP") as TabWidget).setSelect( widget.aliasName === "TAB.SFTP" );
                (this.getAliasWidget("TAB.SSH") as TabWidget).setSelect( widget.aliasName === "TAB.SSH" );
                this.setWidgetForConnectionInfo( this.option.info.find( item => widget.aliasName === "TAB." + item.protocol ) );
                this.initWidget();
            }
        }
        log.debug( "aliasName: %s, eventName: %s, args: %j", widget.aliasName, eventName, args );
    }

    disableConnectionInfo(disable: boolean) {
        this.connectionInfoAliasNames.map( (item) => {            
            this.getAliasWidget(item).disable = disable;
        });
    }

    setWidgetForConnectionInfo(info: IConnectionInfoBase) {
        const updateWidget = (aliasName, value) => {
            log.debug( "aliasName:%s, value: %s", aliasName, value );
            const widget = this.getAliasWidget(aliasName);
            if ( widget ) {
                if ( widget instanceof RadioWidget ) {
                    widget.setValue( value || false );
                } else if ( widget instanceof InputWidget ) {
                    widget.setValue( "" + (value || "") );
                } else if ( widget instanceof TabWidget ) {
                    widget.setSelect( value || false );
                }
            }
        };

        if ( !info ) {
            this.connectionInfoAliasNames.map( (item) => {
                updateWidget( item, null );
            });
            return;
        }

        updateWidget( "host", info.host );
        updateWidget( "port", info.port );
        updateWidget( "username", info.username );
        updateWidget( "password", info.password );
        updateWidget( "privateKey", info.privateKey );
        updateWidget( "proxy", !!info.proxyInfo );

        if ( info.proxyInfo ) {
            updateWidget( "proxy.host", info.proxyInfo.host );
            updateWidget( "proxy.port", info.proxyInfo.port );
            updateWidget( "proxy.type5", info.proxyInfo.type === 5 );
            updateWidget( "proxy.type4", info.proxyInfo.type === 4 );
            updateWidget( "proxy.username", info.proxyInfo.username );
            updateWidget( "proxy.password", info.proxyInfo.password );
        }
    }

    initInputData() {
        (this.getAliasWidget( "name" ) as InputWidget).setValue( this.option.name || "" );

        (this.getAliasWidget( "Protocol.DUAL" ) as RadioWidget).setValue( false );
        (this.getAliasWidget( "Protocol.SFTP" ) as RadioWidget).setValue( false );
        (this.getAliasWidget( "Protocol.SSH" ) as RadioWidget).setValue( false );

        if ( !this.option.info || this.option.info.length === 0 ) {
            return;
        }

        this.setWidgetForConnectionInfo(null);

        for ( let item of this.option.info ) {
            if ( item.protocol === "SFTP_SSH" ) {
                (this.getAliasWidget( "Protocol.DUAL" ) as RadioWidget).setValue( true );
                this.setWidgetForConnectionInfo(item);
                return;
            }
            if ( item.protocol === "SFTP" ) {
                (this.getAliasWidget( "Protocol.DUAL" ) as RadioWidget).setValue( false );
                (this.getAliasWidget( "Protocol.SFTP" ) as RadioWidget).setValue( true );
            }
            if ( item.protocol === "SSH" ) {
                (this.getAliasWidget( "Protocol.DUAL" ) as RadioWidget).setValue( false );
                (this.getAliasWidget( "Protocol.SSH" ) as RadioWidget).setValue( true );
            }
        }

        this.setWidgetForConnectionInfo(this.option.info[0]);
    }

    getConnectionInputData(): IConnectionInfoBase {
        const result: any = {};
        const proxyInfo: any = {};
        let proxy = false;
        this.eventElements.forEach( (item) => {
            if ( this.connectionInfoAliasNames.indexOf(item.aliasName) === -1 ) {
                return;
            }
            if ( item instanceof InputWidget ) {
                if ( item.aliasName.match( /^proxy\./ ) ) {
                    const proxyName = item.aliasName.split(".")[1];
                    if ( item.aliasName.indexOf("port") > -1 ) {
                        proxyInfo[ proxyName ] = parseInt(item.getValue(), 10);
                    } else {
                        proxyInfo[ proxyName ] = item.getValue();
                    }
                } else {
                    if ( item.aliasName.indexOf("port") > -1 ) {
                        result[ item.aliasName ] = parseInt(item.getValue(), 10);
                    } else {
                        result[ item.aliasName ] = item.getValue();
                    }
                }
            } else if ( item instanceof RadioWidget ) {
                if (item.aliasName === "proxy") {
                    proxy = item.getValue();
                }
                if (item.aliasName === "proxy.type5" && item.getValue()) {
                    proxyInfo.type = 5;
                } else if (item.aliasName === "proxy.type4" && item.getValue()) {
                    proxyInfo.type = 4;
                }
            }
        });
        if ( proxy ) {
            result.proxyInfo = proxyInfo;
        }
        return result;
    }

    updateCurrentPositionInfo() {
        this.option.name = (this.getAliasWidget("name") as InputWidget).getValue();
        if ( (this.getAliasWidget( "Protocol.DUAL" ) as RadioWidget).getValue() ) {
            const connInfo = this.getConnectionInputData();
            connInfo.protocol = "SFTP_SSH";
            const infos = this.option.info.filter( item => item.protocol !== "SFTP_SSH" );
            this.option.info = [ ...infos, connInfo ];
        } else {
            if ( (this.getAliasWidget( "TAB.SFTP" ) as TabWidget).hasSelect() ) {
                const connInfo = this.getConnectionInputData();
                connInfo.protocol = "SFTP";
                const infos = this.option.info.filter( item => item.protocol !== "SFTP" );
                this.option.info = [ ...infos, connInfo ];
            } else if ( (this.getAliasWidget( "TAB.SSH" ) as TabWidget).hasSelect() ) {
                const connInfo = this.getConnectionInputData();
                connInfo.protocol = "SSH";
                const infos = this.option.info.filter( item => item.protocol !== "SSH" );
                this.option.info = [ ...infos, connInfo ];
            }
        }
        log.debug( "%s", JSON.stringify(this.option.info, null, 2) );
    }

    getInputData() {
        if ( (this.getAliasWidget( "Protocol.DUAL" ) as RadioWidget).getValue() ) {
            this.option.info = this.option.info.filter( item => item.protocol === "SFTP_SSH" );
        } else {
            this.option.info = this.option.info.filter( item => item.protocol !== "SFTP_SSH" );
        }
        return { name: this.option.name, info: this.option.info };
    }
}
