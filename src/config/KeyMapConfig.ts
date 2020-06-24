import { Logger } from "../common/Logger";
import { IFrameMenuConfig, ISubMenuConfig } from "./MenuConfig";

const log = Logger("MainFrame");

type MethodName = string;
type KeyName = string;

interface IFuncParam {
    key: KeyName | KeyName[];
    funcParam?: any[]
}

interface IMethodParam {
    method: MethodName;
    funcParam: any[]
}

export enum RefreshType {
    ALL = 1,
    OBJECT = 2,
    NONE = 3
}

export interface IKeyMapping {
    [methodName: string]: KeyName | KeyName[] | IFuncParam | IFuncParam[]
}

interface IAllKeyMappingInfo {
    [widgetName: string]: IKeyMapping
}

export const SearchDisallowKeys = [ "escape", "tab", "~", "/", "space", "delete", "home", "end", "backspace", "\\" ];
export const TerminalAllowKeys = [ "C-e", "C-w", "C-o" ];

export const KeyMappingInfo: IAllKeyMappingInfo = {
    Common: {
        refreshPromise: "f5",
        split: [ "C-w" ],
        nextWindow: [ "C-e", "tab" ],
        mcdPromise: "f10",
        menu: "f12",
        quit: "C-q",
        clipboardCopy: "C-c",
        clipboardCut: "C-x",
        clipboardPastePromise: "C-v",
        removePromise: "C-d",
        consoleViewPromise: "escape",
        terminalPromise: "C-o",
        vimPromise: "f4"
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
        keyEnterPromise: [ "enter" ]
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
        keyEnterPromise: [ "enter" ],
        toggleSelect: "space",
        commandBoxShow: "/",
        gotoHomePromise: "~",
        gotoParentPromise: "backspace",
        gotoRootPromise: "\\",
        mkdirPromise: "f7",
        renamePromise: "f2",
        sortChangePromise: "M-c",
        sortReversePromise: "M-a",
        viewResetPromise: "M-r",
        viewOwnerPromise: "M-o",
        toggleExcludeHiddenFilePromise: "M-z",
        setViewColumn: [
            {
                key: "M-0",
                funcParam: [ 0 ]
            },
            {
                key: "M-1",
                funcParam: [ 1 ]
            },
            {
                key: "M-2",
                funcParam: [ 2 ]
            },
            {
                key: "M-3",
                funcParam: [ 3 ]
            },
            {
                key: "M-4",
                funcParam: [ 4 ]
            },
            {
                key: "M-5",
                funcParam: [ 5 ]
            },
            {
                key: "M-6",
                funcParam: [ 6 ]
            }
        ]
    },
    Mcd: {
        keyUp: "up",
        keyDownPromise: "down",
        keyRightPromise: "right",
        keyLeft: "left",
        keyHome: "home",
        keyEnd: "end",
        keyEnterPromise: [ "enter" ],
        keyEscapePromise: "escape",
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
        F5: { name: "Refresh", func: "Common.refreshPromise" },
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
        F5: { name: "Refresh", func: "Common.refreshPromise" },
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
    // log.debug( keyInfo );
    return function <T extends { new(...args: any[]): {} }>(constructor: T) {
        return class extends constructor {
            keyInfo = keyInfo;
            viewName = name;
        };
    };
}

export function methodToKeyname( baseObject, method ) {
    if ( !baseObject || !baseObject.keyInfo ) {
        return null;
    }

    for ( let key of Object.keys(baseObject.keyInfo) ) {
        if ( baseObject.keyInfo[key] === method ) {
            return { humanName: keyHumanReadable(key), key };
        }
    }
    return null;
}

export interface IHintInfo {
    hint?: string;
    help?: string;
    order?: number;
    key?: string;
}

export function Hint( { hint, help, order }: IHintInfo ) {
    return function(target: any, propName: string, description: PropertyDescriptor) {
        target.hintInfo = target.hintInfo || {};
        target.hintInfo[ propName ] = { hint, help, order: order || 10 };
    };
}

export async function keyMappingExec( baseObject, keyInfo ): Promise<RefreshType> {
    if ( !baseObject || !baseObject.keyInfo ) {
        return RefreshType.NONE;
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

        if ( baseObject[ (method as string) ] ) {
            log.info( "keypress [%s] - method: [ %s.%s(%s) ]", keyName, baseObject.viewName, method, param ? param.join(",") : "" );
            let result = RefreshType.NONE;
            try {
                if ( /(p|P)romise/.exec(method as string) ) {
                    result = await baseObject[ (method as string) ].apply(baseObject, param);
                } else {
                    result = baseObject[ (method as string) ].apply(baseObject, param);
                }
                log.info( "RUNNING SUCCESS : %s", result );
            } catch( e ) {
                log.error( "RUNNING FAIL : %s.%s(%s) - %s", baseObject.viewName, method, param ? param.join(",") : "", e.stack );
            }
            return result || RefreshType.OBJECT;
        } else {
            log.info( "keypress [%s] - METHOD UNDEFINED: %s.%s(%s)", keyName, baseObject.viewName, method, param ? param.join(",") : "" );
        }
        return RefreshType.NONE;
    } else {
        log.info( "keyFrame[%s] NULL - %j", keyName, keyInfo );
    }
    return RefreshType.NONE;
}

export function keyHumanReadable(key: string): string {
    if ( !key ) return key;
    if ( key.match( /^C\-/ ) ) {
        return key.replace( /^(C\-)(.+)/, (a, p1, p2) => {
            return "Ctrl+" + p2.toUpperCase();
        });
    }
    if ( key.match( /^M\-/ ) ) {
        return key.replace( /^(M\-)(.+)/, (a, p1, p2) => {
            return "Alt+" + p2.toUpperCase();
        });
    }
    if ( key.match( /^S\-/ ) ) {
        return key.replace( /^(S\-)(.+)/, (a, p1, p2) => {
            return "Shift+" + p2.toUpperCase();
        });
    }

    const resultKeyInfo = {
        pagedown: "PgDn",
        pageup: "PgUp",
        insert: "Ins",
        delete: "Del",
        home: "Home",
        escape: "ESC",
        backspace: "BS"
    };
    if ( resultKeyInfo[ key ] ) {
        return resultKeyInfo[ key ];
    }
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
                    const keyInfoSub: IFuncParam = (keyInfo as IFuncParam[]).find( fP => fP.funcParam && JSON.stringify(fP.funcParam) === JSON.stringify(funcParam) );
                    if ( !keyInfoSub ) {
                        return null;
                    }
                    return Array.isArray(keyInfoSub.key) ? keyInfoSub[0].key : keyInfoSub.key;
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
