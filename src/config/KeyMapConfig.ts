import { Logger } from "../common/Logger";
import { IFrameMenuConfig, ISubMenuConfig } from "./MenuConfig";
import { pbkdf2 } from "crypto";

const log = Logger("MainFrame");

type MethodName = string;
type KeyName = string;
type FuncName = string;

interface IFuncParam {
    key: KeyName | KeyName[];
    funcParam?: any[]
}

interface IMethodParam {
    method: MethodName;
    funcParam: any[]
}

export interface IKeyMapping {
    [methodName: string]: KeyName | KeyName[] | IFuncParam | IFuncParam[]
}

interface IAllKeyMappingInfo {
    [widgetName: string]: IKeyMapping
}

export const KeyMappingInfo: IAllKeyMappingInfo = {
    Common: {
        refresh: "f5",
        split: [ "C-w" ],
        nextWindow: [ "tab", "C-e" ],
        mcdPromise: "f10",
        menu: "f12",
        quit: "C-q"
    },
    Menu: {
        keyUp: "up",
        keyDown: "down",
        keyLeft: "left",
        keyRight: "right",
        keyPageUp: "pageup",
        keyPageDown: "pagedown",
        keyHome: "home",
        keyEnd: "end",
        close: "escape",
        keyEnterPromise: [ "return" ]
    },
    Panel: {
        keyUp: "up",
        keyDown: "down",
        keyLeft: "left",
        keyRight: "right",
        keyPageUp: "pageup",
        keyPageDown: "pagedown",
        keyHome: "home",
        keyEnd: "end",
        keyEnterPromise: [ "return" ],
        commandBoxShow: "/"
    },
    Mcd: {
        keyUp: "up",
        keyDownPromise: "down",
        keyRightPromise: "right",
        keyLeft: "left",
        keyHome: "home",
        keyEnd: "end",
        keyEnterPromise: [ "return" ],
        subDirScanPromise: [
            {
                key: "=",
                funcParam: [ 0 ]
            },
            {
                key: "+",
                funcParam: [ 1 ]
            }
        ],
        subDirRemove: "-"
    }
};

export const FuncKeyMappingInfo = {
    Panel: {
        F1: { name: "Help", func: "Common.help" },
        F2: { name: "Rename", func: "Panel.rename" },
        F3: { name: "Editor", func: "Common.editor" },
        F4: { name: "Vim", func: "Command.vim" },
        F5: { name: "Refresh", func: "Common.refresh" },
        F6: { name: "Remote", func: "Common.remote" },
        F7: { name: "Mkdir", func: "Panel.mkdir", },
        F8: { name: "Remove", func: "Panel.remove" },
        F9: { name: "Size", func: "Panel.size" },
        F10: { name: "MCD", func: "Common.mcdPromise" },
        F11: { name: "QCD", func: "" },
        F12: { name: "Menu", func: "Common.menu" }
    },
    Mcd: {
        F1: { name: "Help", func: "Common.help" },
        F2: { name: "Rename", func: "Mcd.rename" },
        F5: { name: "Refresh", func: "Common.refresh" },
        F7: { name: "Mkdir", func: "Mcd.mkdir", },
        F8: { name: "Remove", func: "Mcd.rename" },
        F9: { name: "Size", func: "Mcd.size" },
        F12: { name: "Menu", func: "Common.menu" }
    }
}

interface IFuncMapping {
    [keyName: string]: MethodName | MethodName[] | IMethodParam | IMethodParam[]
}

const convertFunctionToKey = ( keyFrame: IKeyMapping ): IFuncMapping => {
    let result: IFuncMapping = {};
    Object.keys(keyFrame).forEach( item => {
        let obj = keyFrame[item];
        if ( Array.isArray(obj) ) {
            (obj as any[]).forEach( item2 => {
                if ( typeof(item2) === "string" ) {
                    result[ item2 ] = item;
                } else if ( item2.key ) {
                    if ( !item2.funcParam ) {
                        result[ item2.key ] = item;
                    } else {
                        result[ item2.key ] = { method: item, funcParam: item2.funcParam };
                    }
                }
            });
        } else if ( typeof(obj) === 'string' ) {
            result[obj] = item;
        } else if ( obj.key ) {
            if ( Array.isArray( obj.key ) ) {
                (obj.key as string[]).forEach( item2 => {
                    if ( !(obj as IFuncParam).funcParam ) {
                        result[ item2 ] = item;
                    } else {
                        result[ item2 ] = { method: item, funcParam: (obj as IFuncParam).funcParam };
                    }
                });
            } else {
                if ( !obj.funcParam ) {
                    result[ obj.key ] = item;
                } else {
                    result[ obj.key ] = { method: item, funcParam: obj.funcParam };
                }
            }
        }
    });
    return result;
}

export function KeyMapping( keyFrame: IKeyMapping, name: string = null ) {
    const keyInfo = convertFunctionToKey(keyFrame);
    log.debug( keyInfo );
    return function <T extends { new(...args: any[]): {} }>(constructor: T) {
        return class extends constructor {
            keyInfo = keyInfo;
            viewName = name;
        };
    };
}

export async function keyMappingExec( baseObject, keyInfo ): Promise<Boolean> {
    if ( !baseObject || !baseObject.keyInfo ) {
        log.debug( "No active : %j", baseObject.keyInfo );
        return false;
    }

    log.debug( "[%s] - keyInfo: %j", baseObject.viewName, keyInfo );

    const keyFrame = baseObject.keyInfo as IFuncMapping;
    const keyName = keyInfo.full || keyInfo.name;
    const obj = keyFrame[keyName];
    if ( obj ) {
        let method = obj;
        let param = null;
        if ( typeof( obj ) === "object" ) {
            method = (obj as IMethodParam).method;
            param = (obj as IMethodParam).funcParam;
        }

        log.info( "keypress [%s] - method: %s(%s)", keyName, method, param ? param.join(",") : "" );

        if ( baseObject[ (method as string) ] ) {
            if ( /(p|P)romise/.exec(method as string) ) {
                await baseObject[ (method as string) ].apply(baseObject, param);
            } else {
                baseObject[ (method as string) ].apply(baseObject, param);
            }
            return true;
        }
        return false;
    } else {
        log.info( "keypress [%s] %j", keyName, keyInfo );
    }
    return false;
}

export function keyHumanReadable(key: string): string {
    if ( !key ) return key;
    if ( key.match( /^C\-/ ) ) {
        return key.replace( /^(C\-)(.+)/, (a, p1, p2) => {
            return "Ctrl+" + p2.toUpperCase();
        });
    }
    if ( key.match( /^A\-/ ) ) {
        return key.replace( /^(A\-)(.+)/, (a, p1, p2) => {
            return "Alt+" + p2.toUpperCase();
        });
    }
    if ( key.match( /^S\-/ ) ) {
        return key.replace( /^(S\-)(.+)/, (a, p1, p2) => {
            return "Shift+" + p2.toUpperCase();
        });
    }
    if ( key === "pagedown" ) return "PgDn";
    if ( key === "pageup" ) return "PgUp";
    if ( key === "insert" ) return "Ins";
    if ( key === "delete" ) return "Del";
    if ( key === "home" ) return "Home";
    return key.toUpperCase();
}

export function menuKeyMapping( allkeyMappingInfo: IAllKeyMappingInfo, menuObject: IFrameMenuConfig ) {
    const getKeyName = (method, funcParam): string => {
        try {
            let methodInfo = method.split(".");
            let keyInfo = allkeyMappingInfo[ methodInfo[0] ][ methodInfo[1] ];
            if ( Array.isArray( keyInfo ) ) {
                if ( typeof(keyInfo[0]) === "string" ) {
                    return keyInfo[0];
                } else if ( funcParam ) {
                    const key = (keyInfo as IFuncParam[]).find( fP => fP.funcParam === funcParam );
                    return Array.isArray(key) ? key[0] : key;
                }
            } else {
                return keyInfo as string;
            }
        } catch( e ) {
            log.error( "menuKeyMapping: ", e );
            return null;
        }
        return null;
    };

    Object.keys(menuObject).forEach( i => {
        Object.keys(menuObject[i]).forEach( j => {            
            menuObject[i][j].map( (item: ISubMenuConfig | string ) => {
                if ( typeof(item) === "object" && item.method ) {
                    let key = getKeyName(item.method, item.funcParam);
                    if ( key ) {
                        item.key = key;
                    }
                }
            });
        });
    });
}
