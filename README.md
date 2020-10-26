![Mdir.js](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.8.1.gif?raw=true)

# Instruction 

Mdir.js is a visual file manager.

It's a feature rich full-screen text mode application that allows you to copy, move and delete files and whole directory trees, search for files and run commands in the sub-shell.

It's a clone of Mdir, the famous file manager from the MS-DOS age. Mdir.js inherits the keyboard shortcuts and the screen layout from Mdir to maximize user-friendliness.

The best feature of Mdir.js are its ability to connect SFTP, SSH and view tar and zip files and it's convenient to operate the terminal shell inside the sub-window.

Also, you can connect directly to the same client through SSH after SFTP remote access and it's convenient to go directly from the SFTP directory to the SSH directory.

For bug reports, comments and questions, please send to [GitHub Issues Site](https://github.com/la9527/mdir.js/issues) or email to la9527@daum.net.

 - [한국어 설명 링크](https://github.com/la9527/mdir.js/blob/master/README_KO.md)

 
# Tested OS

 - Windows 10
 - MAC OSX Catalina (10.15.x)
 - Ubuntu Linux

# License

 Mdir.js is distributed under the BSD 3-Clause License.
 See ['LICENSE'] for the detail.

# Binary Download

 - Windows 10

 - Mac OSX

# Build & Installation

### 1) Dependencies
 - Common
    - [Node.js](https://node.js) >= 10.x 

 - Windows

    `npm install` requires some tools to be present in the system like Python and C++ compiler. Windows users can easily install them by running the following command in PowerShell as administrator. For more information see https://github.com/felixrieseberg/windows-build-tools:

    ```bash
    $ npm install -g --production windows-build-tools
    ```

 - Mac OS

    Xcode is needed to compile the sources, this can be installed from the App Store.

 - Linux/Ubuntu 

    ```bash
    sudo apt install -y make python build-essential
    ```

### 2) Install 

```
$ mkdir mdir
$ cd mdir
$ npm install mdir.js
```

### 3) Run 

```bash
$ mdir
```

 - If it does not run, close the terminal and try again.

## Version History

- v1.1.0
    - [ADD] Support the xz compress file.
- v1.0.0
    - [ADD] Supports the SFTP and the SSH Connection. (F6)
    - [ADD] The terminal(sub-shell) supports the full screen. (Ctrl+U)
    - [ADD] When directory change on the terminal(sub-shell) then it is auto detect, 
            and when quit the terminal, move to a last stayed directory.
- v0.8.4
    - [bugfix] bugfix for execute a file name with blank characters.(win32)
    - [improve] js, ts files apply a ESLint.
- v0.8.3
    - Add option to select a program when running the program. (Ctrl+R)
    - Add configuration file.
- v0.8.2
    - [bugfix] package dependency for windows 10
    - [add] show logo at startup
- v0.8.1
    - compressed files support (zip, tar.gz, gz, bz2)
      (Supports copy, remove, rename, create directories of the selected files in the compressed file viewer.)
- v0.7.x
    - simple editor support in the window box. (auto detect text file encoding)
- v0.6.x 
    - korean text translation support
- v0.5.x 
    - simple image viewer support (png, jpeg, gif)
    - true color image support in the iTerm (MacOS only).
- v0.4.x 
    - terminal support(sub-shell) in the window box.
- v0.2.x
    - Add the hint on the bottom side.
    - Add the command line at the bottom side (press slash('/') key)
- v0.1.x
    - Support the mcd(directory changer of tree design) in the window box.

# Gallery

### 1. Main Screen (Split Window)
![Mdir.js MAIN](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.1_windows10_cmd.png?raw=true)

### 2. Mcd Screen (Tree viewer)
![Mdir.js MCD](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.1_windows10_cmd_mcd.png?raw=true)

### 3. Terminal(Sub-shell) in the inside window
![Mdir.js XTerm](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.8.1_zsh_terminal.png?raw=true)

### 4. Internal Editor
![Mdir.js XTerm](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.8.1_inside_editor.png?raw=true)

### 5. Simple Terminal Image Viewer
![Mdir.js XTerm](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.8.1_picture_viewer.png?raw=true)

### 6. SSH, SFTP Support
![Mdir.js SSH,SFTP](https://github.com/la9527/mdir.js/blob/master/images/mdir_1.0.0_connection_manager.png?raw=true)
