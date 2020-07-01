import { T } from "../common/Translation";

export interface ISubMenuConfig {
    name: string;
    method ?: string;
    funcParam ?: any[];
    key ?: string;
}

export interface IMainMenuConfig {
    [mainMenu: string]: (ISubMenuConfig | string)[]
}

export interface IFrameMenuConfig {
    [frame: string]: IMainMenuConfig;
}

export const menuConfig: IFrameMenuConfig = {
    Panel: {
        Mdir: [ 
            { name: T("Menu.About"), method: "Common.aboutPromise" },
            { name: T("Menu.Help"), method: "Common.helpPromise" },
            "-",
            { name: T("Menu.Settings") },
            "-",
            { name: T("Menu.Quit"), method: "Common.quit" }
        ],
        Run: [
            { name: T("Menu.Run"), method: "Panel.keyEnterPromise" },
            { name: T("Menu.Run(select)") },
            "-",
            { name: T("Menu.View Console"), method: "Common.consoleViewPromise" }
        ],
        File: [
            { name : T("Menu.New") },
            "-",
            { name: T("Menu.Copy"), method: "Common.clipboardCopy" },
            { name: T("Menu.Cut"), method: "Common.clipboardCut" },
            { name: T("Menu.Paste"), method: "Common.clipboardPastePromise" },
            "-",
            { name: T("Menu.Find") },
            { name: T("Menu.Diff") }
        ],
        Directory: [
            { name: T("Menu.Mcd"), method: "Common.mcdPromise" },
            { name: T("Menu.MountList"), method: "Common.mountListPromise" },
            "-",
            { name: T("Menu.Mkdir"), method: "Panel.mkdirPromise" },
            { name: T("Menu.To parent"), method: "Panel.gotoParentPromise" },
            { name: T("Menu.To root") , method: "Panel.gotoRootPromise" },
            { name: T("Menu.To home"), method: "Panel.gotoHomePromise" },
            "-",
            { name: T("Menu.Back") },
            { name: T("Menu.Forward") }
        ],
        View: [
            { name: T("Menu.Refresh"), method: "Common.refreshPromise" },
            { name: T("Menu.Column AUTO"), method: "Panel.setViewColumn", funcParam: [ 0 ] },
            "-",
            { name: T("Menu.Column 1"), method: "Panel.setViewColumn", funcParam: [ 1 ] },
            { name: T("Menu.Column 2"), method: "Panel.setViewColumn", funcParam: [ 2 ] },
            { name: T("Menu.Column 3"), method: "Panel.setViewColumn", funcParam: [ 3 ] },
            { name: T("Menu.Column 4"), method: "Panel.setViewColumn", funcParam: [ 4 ] },
            "-",
            { name: T("Menu.Hidden file on/off"), method: "Panel.toggleExcludeHiddenFilePromise" },
            (process.platform !== 'win32' ? { name: T("Menu.Owner show on/off"), method: "Panel.viewOwnerPromise" } : null),
            { name: T("Menu.Sort change"), method: "Panel.sortChangePromise" },
            { name: T("Menu.Sort Asc/Descend"), method: "Panel.sortReversePromise" },
            "-",
            { name: T("Menu.Sort Reset"), method: "Panel.sortResetPromise" },
            "-",
            { name: T("Menu.Split"), method: "Common.split" },
            { name: T("Menu.Next Window"), method: "Common.nextWindow" }
        ],
        Terminal: [
            { name: T("Menu.Terminal"), method: "Common.terminalPromise" },
            "-",
            { name: T("Menu.Vim"), method: "Common.vimPromise" }
        ]
    }
};

