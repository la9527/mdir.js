/* eslint-disable prefer-spread */
import { Logger } from "../common/Logger";
import { IFrameMenuConfig, ISubMenuConfig } from "./MenuConfig";
import { sprintf } from "sprintf-js";
import { T } from "../common/Translation";
import * as os from "os";

const log = Logger("MainFrame");

type MethodName = string;
type KeyName = string;

interface IFuncParam {
    key: KeyName | KeyName[];
    funcParam?: any[];
    name?: string;
}

interface IMethodParam {
    method: MethodName;
    funcParam: any[];
    name: string;
}

export enum RefreshType {
    ALL = 1,
    OBJECT = 2,
    NONE = 3
}

export interface IKeyMapping {
    [methodName: string]: KeyName | KeyName[] | IFuncParam | IFuncParam[];
}

interface IAllKeyMappingInfo {
    [widgetName: string]: IKeyMapping;
}

export const SearchDisallowKeys = [ "escape", "tab", "~", "/", "space", "delete", "home", "end", "backspace", "\\" ];
export const TerminalAllowKeys = [ "C-e", "C-w", "C-o", "C-b", "C-f", "C-up", "C-down", "S-up", "S-down", "M-f", "M-b" ];

export const KeyMappingInfo: IAllKeyMappingInfo = {
    Common: {
        refreshPromise: { name: T("Func.Refresh"), key: "f5" },
        split: [ "C-w" ],
        nextWindow: [ "C-e", "tab" ],
        mcdPromise: { name: T("Func.MCD"), key: "f10" },
        menu: { name: T("Func.Menu"), key: "f12" },
        quitPromise: "C-q",
        clipboardCopy: "C-c",
        clipboardCut: "C-x",
        clipboardPastePromise: "C-v",
        removePromise: "C-d",
        consoleViewPromise: "escape",
        terminalPromise: "C-o",
        vimPromise: { name: T("Func.VIM"), key: "f4" },
        mountListPromise: { name: T( os.platform() === "win32" ? "Func.DriveList" : "Func.MountList"), key: "f11" },
        helpPromise: { name: T("Func.Help"), key: "f1" },
        editorPromise: { name: T("Func.Editor"), key: "f3" },
        panelSyncPromise: "C-s",
        createArchiveFilePromise: "C-p"
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
        keyEnterSelectPromise: [ "C-r" ],
        toggleSelect: "space",
        commandBoxShow: "/",
        gotoHomePromise: "~",
        gotoParentPromise: "backspace",
        gotoRootPromise: "\\",
        mkdirPromise: { name: T("Func.Mkdir"), key: "f7" },
        renamePromise: { name: T("Func.Rename"), key: "f2" },
        selectAllFiles: "C-a",
        sortChangePromise: "M-c",
        sortReversePromise: "M-a",
        sortResetPromise: "M-r",
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
        subDirHide: "-"
    },
    XTerm: {
        keyScrollUp: [ "C-b", "C-up", "S-up" ],
        keyScrollDown: [ "C-f", "C-down", "S-down" ],
        keyScrollPageUp: [ "M-b" ],
        keyScrollPageDown: [ "M-f" ]
    },
    Editor: {
        keyUp: "up",
        keyDown: "down",
        keyRight: "right",
        keyLeft: "left",
        keyHome: "home",
        keyEnd: "end",
        keyEnter: [ "enter" ],
        keyPgUp: "pageup",
        keyPgDn: "pagedown",
        keyInsert: "insert",
        keyDelete: "delete",
        keyBS: "backspace",
        keyTab: "tab",
        keyUntab: "S-tab",
        indentMode: "f2",
        gotoLinePromise: "C-g",
        gotoFirst: "C-f",
        gotoLast: "C-l",
        copy: "C-c",
        cut: "C-x",
        paste: "C-v",
        undo: "C-z",
        keyEscape: "escape",
        select: { name: T("Func.Select"), key: "f2" },
        selectAll: "C-a",
        fileNewPromise: "C-n",
        fileSavePromise: "C-s",
        fileSaveAsPromise: "A-s",
        findPromise: { name: T("Func.Find"), key: [ "C-f", "f4" ] },
        findNextPromise: { name: T("Func.NextFind"), key: "f3" },
        filePreviousPromise: "C-b",
        quitEditorPromise: "C-q"
    }
};

interface IFuncMapping {
    [keyName: string]: MethodName | MethodName[] | IMethodParam | IMethodParam[];
}

const convertFunctionToKey = ( keyFrame: IKeyMapping ): IFuncMapping => {
    const result: IFuncMapping = {};
    Object.keys(keyFrame).forEach( item => {
        const obj = keyFrame[item];
        if ( Array.isArray(obj) ) {
            (obj as any[]).forEach( item2 => {
                if ( typeof(item2) === "string" ) {
                    result[ item2 ] = item;
                } else if ( item2.key ) {
                    if ( !item2.funcParam && !item2.name ) {
                        result[ item2.key ] = item;
                    } else {
                        result[ item2.key ] = { method: item, funcParam: item2.funcParam, name: item2.name };
                    }
                }
            });
        } else if ( typeof(obj) === "string" ) {
            result[obj] = item;
        } else if ( obj.key ) {
            if ( Array.isArray( obj.key ) ) {
                (obj.key as string[]).forEach( item2 => {
                    if ( !(obj as IFuncParam).funcParam && !(obj as IFuncParam).name ) {
                        result[ item2 ] = item;
                    } else {
                        result[ item2 ] = { method: item, funcParam: (obj as IFuncParam).funcParam, name: (obj as IFuncParam).name };
                    }
                });
            } else {
                if ( !obj.funcParam && !obj.name ) {
                    result[ obj.key ] = item;
                } else {
                    result[ obj.key ] = { method: item, funcParam: obj.funcParam, name: obj.name };
                }
            }
        }
    });
    return result;
};

export function KeyMapping( keyFrame: IKeyMapping ) {
    const keyInfo = convertFunctionToKey(keyFrame);
    log.debug( keyInfo );
    // eslint-disable-next-line @typescript-eslint/ban-types
    return function <T extends new(...args: any[]) => {}>(constructor: T) {
        return class extends constructor {
            keyInfo = keyInfo;
        };
    };
}

export function methodToKeyname( baseObject, method ) {
    if ( !baseObject || !baseObject.keyInfo ) {
        return null;
    }

    for ( const key of Object.keys(baseObject.keyInfo) ) {
        if ( baseObject.keyInfo[key] === method ) {
            try {
                if ( typeof(key) === "string" && key ) {
                    return { humanKeyName: keyHumanReadable(key), key };
                }
            } catch ( e ) {
                log.debug( "METHODTOKEYNAME ERROR !!! - %j", key );
                return null;
            }
        }
    }
    return null;
}

export interface IHintInfo {
    hint?: string;
    order?: number;
    key?: string;
}

export function Hint( { hint, order }: IHintInfo ) {
    return function(target: any, propName: string, _description: PropertyDescriptor) {
        target.hintInfo = target.hintInfo || {};
        target.hintInfo[ propName ] = { hint, order: order || 10 };
    };
}

export interface IHelpInfo {
    [ frame: string ]: {
        [ methodName: string ]: {
            method?: string;
            text?: string;
            key?: string | string[];
            humanKeyName?: string;
        };
    };
}

export interface IHelpService {
    viewName(): string;
}

const helpInfo = {};

export function Help( helpText: string ) {
    return function(target: any, propName: string, _description: PropertyDescriptor) {
        const name = target.viewName();
        if ( name ) {
            helpInfo[name] = helpInfo[name] || {};

            const keyInfo = () => {
                const item: any = (KeyMappingInfo[name] && KeyMappingInfo[name][propName]);
                if ( Array.isArray(item) ) {
                    return (item as any[]).map( (sub) => sub.key ? sub.key : sub );
                } else if ( item && item.key ) {
                    return item.key;
                }
                return item;
            };

            const key = keyInfo();
            let humanKeyName = "";
            if ( Array.isArray(key) ) {
                humanKeyName = key.map( (item1) => {
                    return keyHumanReadable(item1);
                }).join(", ");
            } else if ( key ) {
                humanKeyName = keyHumanReadable(key);
            }
            helpInfo[name][propName] = { method: propName, text: helpText, key, humanKeyName };
        }
        // log.debug( "%s - %s", name, helpText );
    };
}

export function getHelpInfo(): IHelpInfo {
    return helpInfo;
}

export function functionKeyInfo( baseObject ) {
    const functionKeyInfo = {};

    if ( !baseObject || !baseObject.keyInfo ) {
        return functionKeyInfo;
    }

    const keyFrame = baseObject.keyInfo as IFuncMapping;
    for ( let i = 1; i <= 12; i++ ) {
        if ( keyFrame["f" + i] ) {
            if ( typeof(keyFrame["f" + i]) === "string" ) {
                functionKeyInfo["F" + i] = keyFrame["f" + i];
            } else if ( (keyFrame["f" + i] as IMethodParam) && (keyFrame["f" + i] as IMethodParam).name ) {
                functionKeyInfo["F" + i] = (keyFrame["f" + i] as IMethodParam).name;
            }
        }
    }
    return functionKeyInfo;
}

export async function keyMappingExec( baseObject, keyInfo ): Promise<RefreshType> {
    if ( !baseObject || !baseObject.keyInfo ) {
        return RefreshType.NONE;
    }

    log.debug( "[%s] - keyInfo: %j", baseObject.viewName(), keyInfo );

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
            log.info( "keypress [%s] - method: [ %s.%s(%s) ]", keyName, baseObject.viewName(), method, param ? param.join(",") : "" );
            let result = RefreshType.NONE;
            try {
                if ( /(p|P)romise/.exec(method as string) ) {
                    result = await baseObject[ (method as string) ].apply(baseObject, param);
                } else {
                    result = baseObject[ (method as string) ].apply(baseObject, param);
                }
            } catch( e ) {
                throw sprintf( "FAIL : %s.%s(%s)\n%s", baseObject.viewName(), method, param ? param.join(",") : "", e.stack );
            }
            return result || RefreshType.OBJECT;
        } else {
            log.info( "keypress [%s] - METHOD UNDEFINED: %s.%s(%s)", keyName, baseObject.viewName(), method, param ? param.join(",") : "" );
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
            const methodInfo = method.split(".");
            let keyInfo = allkeyMappingInfo[ methodInfo[0] ][ methodInfo[1] ];
            if ( keyInfo && (keyInfo as any).key ) {
                keyInfo = (keyInfo as any).key;
            }
            if ( Array.isArray( keyInfo ) ) {
                if ( typeof(keyInfo[0]) === "string" ) {
                    return keyInfo[0];
                } else if ( funcParam ) {
                    const keyInfoSub: IFuncParam = (keyInfo as IFuncParam[]).find( 
                        fP => fP.funcParam && JSON.stringify(fP.funcParam) === JSON.stringify(funcParam) );
                    if ( !keyInfoSub ) {
                        return null;
                    }
                    return Array.isArray(keyInfoSub.key) ? keyInfoSub[0].key : keyInfoSub.key;
                }
            } else if ( typeof(keyInfo) === "string" ) {
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
                if ( typeof(item) === "object" && item && item.method ) {
                    const key = getKeyName(item.method, item.funcParam);
                    if ( key ) {
                        item.key = key;
                    }
                }
            });
        });
    });
}

