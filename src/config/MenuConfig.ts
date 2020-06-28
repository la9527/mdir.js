
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
        "Mdir.js": [ 
            { name: "About", method: "Common.aboutPromise" },
            { name: "Help", method: "Common.helpPromise" },
            "-",
            { name: "Settings" },
            "-",
            { name: "Quit", method: "Common.quit" }
        ],
        Run: [
            { name: "Run", method: "Panel.keyEnterPromise" },
            { name: "Run(select)" },
            "-",
            { name: "View Console", method: "Common.consoleViewPromise" }
        ],
        File: [
            { name : "New" },
            "-",
            { name: "Copy", method: "Common.clipboardCopy" },
            { name: "Cut", method: "Common.clipboardCut" },
            { name: "Paste", method: "Common.clipboardPastePromise" },
            "-",
            { name: "Find" },
            { name: "Diff" }
        ],
        Directory: [
            { name: "Mcd", method: "Common.mcdPromise" },
            { name: "Mount List", method: "Common.mountListPromise" },
            "-",
            { name: "Mkdir", method: "Panel.mkdirPromise" },
            { name: "To parent", method: "Panel.gotoParentPromise" },
            { name: "To root" , method: "Panel.gotoRootPromise" },
            { name: "To home", method: "Panel.gotoHomePromise" },
            "-",
            { name: "Back" },
            { name: "Forward" }
        ],
        View: [
            { name: "Refresh", method: "Common.refreshPromise" },
            { name: "Column AUTO", method: "Panel.setViewColumn", funcParam: [ 0 ] },
            "-",
            { name: "Column 1", method: "Panel.setViewColumn", funcParam: [ 1 ] },
            { name: "Column 2", method: "Panel.setViewColumn", funcParam: [ 2 ] },
            { name: "Column 3", method: "Panel.setViewColumn", funcParam: [ 3 ] },
            { name: "Column 4", method: "Panel.setViewColumn", funcParam: [ 4 ] },
            "-",
            { name: "Hidden file on/off", method: "Panel.toggleExcludeHiddenFilePromise" },
            (process.platform !== 'win32' ? { name: "Owner show on/off", method: "Panel.viewOwnerPromise" } : null),
            { name: "Sort change", method: "Panel.sortChangePromise" },
            { name: "Sort Asc/Descend", method: "Panel.sortReversePromise" },
            "-",
            { name: "Reset", method: "Panel.viewResetPromise" },
            "-",
            { name: "Split", method: "Common.split" },
            { name: "Next Window", method: "Common.nextWindow" }
        ],
        Terminal: [
            { name: "Shell", method: "Common.terminalPromise" },
            "-",
            { name: "Vim", method: "Common.vimPromise" }
        ]
    }
};

