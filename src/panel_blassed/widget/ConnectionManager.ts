/* eslint-disable prefer-const */
import { Widgets, text, line } from "neo-blessed";
import { Widget } from "./Widget";
import { widgetsEventListener } from "./WidgetsEventListener";
import { Logger } from "../../common/Logger";
import { ColorConfig } from "../../config/ColorConfig";
import { InputWidget } from "./InputWidget";
import { ButtonWidget } from "./ButtonWidget";
import { RadioWidget } from "./RadioWidget";

const log = Logger("ConnectionManager");

export interface IConnectionInfo {
    name: string;
    host: string;
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

export interface IConnectionWidgetOption extends IConnectionInfo {    
    resultFunc: ( result: boolean, data: IConnectionInfo | any ) => void;
}

export class ConnectionManager extends Widget {
    private titleWidget: Widget = null;    
    private elementsInfo: any[] = [];
    private eventElements: Widget[] = [];
    
    private color = null;    
    private option: IConnectionWidgetOption = null;

    constructor( option: IConnectionWidgetOption, opts: Widgets.BoxOptions | any ) {
        super({
            ...(opts || {}),
            width: 70,
            height: 21,
            top: "center",
            left: "center",
            border: "line",
            clickable: true
        });
        this.option = option;
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

        const proxyInfo = this.option.proxyInfo || {};
        this.elementsInfo = [
            { top: 2, type: "input", name: "name", label: "Name", default: this.option.name },
            { top: 4, type: "input", name: "host", label: "Host", default: this.option.host },
            { top: 5, type: "input", name: "port", label: "Port", default: this.option.port || 22 },
            { top: 6, type: "input", name: "username", label: "Username", default: this.option.username },
            { top: 7, type: "input", name: "password", label: "Password", passwordType: true, default: this.option.password },
            { top: 9, type: "input", name: "privateKey", label: "Private Key File Path", default: this.option.privateKey },
            { top: 10, left: 0, width: "100%-2", type: "line", orientation: "horizontal" },
            { top: 11, left: 25, width: 20, type: "checkbox", name: "proxy", label: "Use Proxy", default: !!this.option.proxyInfo },
            { top: 12, type: "input", name: "proxy.host", label: "Proxy Host", default: proxyInfo.host },
            { top: 13, type: "input", name: "proxy.port", label: "Proxy Port", default: proxyInfo.port },
            { top: 14, left: 3, width: 20, type: "label", content: "Proxy Protocol" },
            { top: 14, left: 25, width: 20, type: "radiobox", name: "proxy.type5", label: "Type 5", default: proxyInfo.type === 5 },
            { top: 14, left: 40, width: 20, type: "radiobox", name: "proxy.type4", label: "Type 4", default: proxyInfo.type === 4 },
            { top: 15, type: "input", name: "proxy.userId", label: "Proxy Username", default: proxyInfo.username },
            { top: 16, type: "input", name: "proxy.password", label: "Proxy Password", passwordType: true, default: proxyInfo.password },

            { top: 17, left: 0, width: "100%-2", type: "line", orientation: "horizontal" },
            { top: 18, left: 10, width: 10, type: "button", name: "ok", label: "Ok" },
            { top: 18, left: 40, width: 10, type: "button", name: "cancel", label: "Cancel" }
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
                this.eventElements.push(new ButtonWidget({ ...buttonOption, top: item.top, left: item.left, aliasName: item.name, content: item.label }));
            } else if ( item.type === "line" ) {
                line({ ...commonOption, ...item });
            } else if ( item.type === "label" ) {
                text({ ...labelTextOption, ...item });
            } else if ( [ "checkbox", "radiobox" ].indexOf(item.type) > -1 ) {
                this.eventElements.push(new RadioWidget(
                    { ...commonOption, top: item.top, left: item.left, width: item.width, aliasName: item.name }, 
                    { text: item.label, isCheck: item.type === "checkbox", defaultCheck: item.default || false }));
            }
        });

        widgetsEventListener( this.eventElements, (widget: Widget, index: number, eventName: string, args: any[] ) => {
            this.onEventListener( widget, index, eventName, args );
        });

        this.initWidget();
        this.eventElements[0].setFocus();
    }

    getAliasWidget( name: string ) {
        return this.eventElements.find( (item: Widget) => item.aliasName === name );
    }

    initWidget() {
        const isProxy = (this.getAliasWidget("proxy") as RadioWidget).getValue();
        const proxyWidgets = this.eventElements.filter( (item: Widget) => item.aliasName.match( /^proxy\./ ) );
        proxyWidgets.forEach( item => {
            item.disable = !isProxy;
            log.debug( "ALIAS: %s - isProxy: %s DISABLE : %s", item.aliasName, isProxy, item.disable );
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
        
    }

    onEventListener( widget: Widget, index, eventName, args: any[] ) {
        if ( eventName === "widget.return" ) {
            if ( [ "ok", "cancel" ].indexOf(widget.aliasName) > -1 ) {
                if ( widget.aliasName === "ok" ) {
                    this.option.resultFunc( true, this.getInputData() );
                }
                this.destroy();
            }
            return;
        }
        if ( eventName === "widget.changeradio" ) {
            if ( [ "proxy.type5", "proxy.type4" ].indexOf(widget.aliasName) > -1 ) {
                (this.getAliasWidget("proxy.type4") as RadioWidget).setValue( widget.aliasName === "proxy.type4" );
                (this.getAliasWidget("proxy.type5") as RadioWidget).setValue( widget.aliasName === "proxy.type5" );
            } else if ( widget.aliasName === "proxy" ) {
                this.initWidget();
            }
        }
        log.debug( "aliasName: %s, eventName: %s, args: %j", widget.aliasName, eventName, args );
    }

    getInputData() {
        const result: any = {};
        const proxyInfo: any = {};
        let proxy = false;
        this.eventElements.map( (item) => {
            if ( item instanceof InputWidget ) {
                if ( item.aliasName.match( /^proxy\./ ) ) {
                    const proxyName = item.aliasName.split(".")[1];
                    proxyInfo[ proxyName ] = item.getValue();
                } else {
                    result[ item.aliasName ] = item.getValue();
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
}
