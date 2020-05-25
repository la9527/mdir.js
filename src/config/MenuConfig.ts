
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
        LinM: [ 
            { name: "About", method: "Common.about" },
            { name: "Help", method: "Panel.help" },
            "-",
            { name: "Settings" },
            "-",
            { name: "Quit LinM", method: "Common.quit" }
        ],
        Run: [
            { name: "Run", method: "Panel.keyEnterPromise" },
            { name: "Run(select)" },
            "-",
            { name: "View Console" }
        ],
        File: [
            { name : "New" },
            "-",
            { name: "ClipCopy" },
            { name: "ClipCut" },
            { name: "ClipPaste" },
            "-",
            { name: "Find" },
            { name: "Diff" }
        ],
        Directory: [
            { name: "Mcd", method: "Common.runMcd" },
            { name: "Qcd" },
            "-",
            { name: "Mkdir" },
            { name: "To parent" },
            { name: "To root" },
            { name: "To home" },
            "-",
            { name: "Back" },
            { name: "Forward" }
        ],
        View: [
            { name: "Refresh", method: "Panel.refresh" },
            { name: "Column AUTO" },
            "-",
            { name: "Column 1" },
            { name: "Column 2" },
            { name: "Column 3" },
            { name: "Column 4" },
            "-",
            { name: "Hidden file on/off" },
            { name: "Owner show on/off" },
            { name: "Sort change" },
            { name: "Sort Asc/Descend" },
            "-",
            { name: "Split", method: "Common.split" },
            { name: "Next Window", method: "Common.nextWindow" }
        ]
    }
};

