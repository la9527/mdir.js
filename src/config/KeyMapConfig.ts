import { Logger } from "../common/Logger";

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
        nextWindow: [ "tab", "C-e" ]
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
        keyEnterPromise: [ "enter" , "return" ]
    },
    Mcd: {
        keyUp: "up",
        keyDownPromise: "down",
        keyRightPromise: "right",
        keyLeft: "left",
        keyHome: "home",
        keyEnd: "end",
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

export function KeyMapping( keyFrame: IKeyMapping ) {
    const keyInfo = convertFunctionToKey(keyFrame);
    log.debug( keyInfo );
    return function <T extends { new(...args: any[]): {} }>(constructor: T) {
        return class extends constructor {
            keyInfo = keyInfo;
        };
    };
}

export async function keyMappingExec( baseObject, keyInfo ): Promise<Boolean> {
    if ( !baseObject || !baseObject.keyInfo ) {
        log.debug( "No active : %j", baseObject.keyInfo );
        return false;
    }

    log.debug( "keyInfo: %j", keyInfo );

    const keyFrame = baseObject.keyInfo as IFuncMapping;
    const keyName = keyInfo.name || keyInfo.full;
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
