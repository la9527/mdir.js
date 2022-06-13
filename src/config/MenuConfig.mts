import { T } from "../common/Translation.mjs";

export interface ISubMenuConfig {
    name: string;
    method?: string;
    funcParam?: any[];
    key?: string;
}

export interface IMainMenuConfig {
    [mainMenu: string]: (ISubMenuConfig | string)[];
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
            { name: T("Menu.Settings"), method: "Common.settingPromise" },
            "-",
            { name: T("Menu.Quit"), method: "Common.quitPromise" }
        ],
        Run: [
            { name: T("Menu.Run"), method: "Panel.keyEnterPromise" },
            { name: T("Menu.Run(select)"), method: "Panel.keyEnterSelectPromise" },
            "-",
            { name: T("Menu.View Console"), method: "Common.consoleViewPromise" }
        ],
        File: [
            { name: T("Menu.New"), method: "Panel.newFilePromise" },
            "-",
            { name: T("Menu.Copy"), method: "Common.clipboardCopy" },
            { name: T("Menu.Cut"), method: "Common.clipboardCut" },
            { name: T("Menu.Paste"), method: "Common.clipboardPastePromise" },
            "-",
            { name : T("Menu.Archive"), method: "Common.createArchiveFilePromise" },
            /*
            "-",
            { name: T("Menu.Find") },
            { name: T("Menu.Diff") }
            */
        ],
        Directory: [
            { name: T("Menu.Mcd"), method: "Common.mcdPromise" },
            { name: T("Menu.MountList"), method: "Common.mountListPromise" },
            { name: T("Menu.PanelSync"), method: "Common.panelSyncPromise" },
            "-",
            { name: T("Menu.Mkdir"), method: "Panel.mkdirPromise" },
            { name: T("Menu.To parent"), method: "Panel.gotoParentPromise" },
            { name: T("Menu.To root") , method: "Panel.gotoRootPromise" },
            { name: T("Menu.To home"), method: "Panel.gotoHomePromise" },
            "-",
            { name: T("Menu.Back"), method: "Panel.gotoBackPromise" },
            { name: T("Menu.Forward"), method: "Panel.gotoForwardPromise" },
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
            (process.platform !== "win32" ? { name: T("Menu.Owner show on/off"), method: "Panel.viewOwnerPromise" } : null),
            { name: T("Menu.Sort change"), method: "Panel.sortChangePromise" },
            { name: T("Menu.Sort Asc/Descend"), method: "Panel.sortReversePromise" },
            "-",
            { name: T("Menu.Sort Reset"), method: "Panel.sortResetPromise" },
            "-",
            { name: T("Menu.Split"), method: "Common.split" },
            { name: T("Menu.Next Window"), method: "Common.nextWindow" }
        ],
        Utility: [
            { name: T("Menu.ConnectionManager"), method: "Common.connectionManagerPromise" },
            "-",
            { name: T("Menu.Terminal"), method: "Common.terminalPromise" },
            "-",
            { name: T("Menu.Vim"), method: "Common.vimPromise" }
        ]
    },
    Editor: {
        File: [
            { name: T("Menu.New"), method: "Editor.fileNewPromise" },
            "-",
            { name: T("Menu.Save"), method: "Editor.fileSavePromise" },
            { name: T("Menu.SaveAs"), method: "Editor.fileSaveAsPromise" },
            "-",
            { name: T("Menu.Quit"), method: "Editor.quitEditorPromise" }
        ],
        Edit: [
            { name: T("Menu.Undo"), method: "Editor.undo" },
            "-",
            { name: T("Menu.Cut"), method: "Editor.cut" },
            { name: T("Menu.Copy"), method: "Editor.copy" },
            { name: T("Menu.Paste"), method: "Editor.paste" },
            "-",
            { name: T("Menu.Indent"), method: "Editor.tab" },
            { name: T("Menu.Unindent"), method: "Editor.untab" },
            "-",
            { name: T("Menu.SelectAll"), method: "Editor.selectAll" },
            "-",
            { name: T("Menu.SelectMode"), method: "Editor.select" }
        ],
        View: [
            { name: T("Menu.Refresh"), method: "Common.refreshPromise" },
            "-",
            { name: T("Menu.Split"), method: "Common.split" },
            { name: T("Menu.Next Window"), method: "Common.nextWindow" },
            "-",
            { name: T("Menu.GotoLine"), method: "Common.gotoLinePromise" },
            "-",
            { name: T("Menu.GotoTop"), method: "Common.gotoTop" },
            { name: T("Menu.GotoLast"), method: "Common.gotoLast" }
        ]
    }
};

