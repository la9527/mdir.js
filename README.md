![Mdir.js](https://github.com/la9527/mdir.js/blob/master/images/mdir_v0.8.1.gif?raw=true)

# Instruction

Mdir.js is a visual file manager.

It's a feature rich full-screen text mode application that allows you to copy, move and delete files and whole directory trees, search for files and run commands in the sub-shell.

It's a clone of Mdir, the famous file manager from the MS-DOS age. Mdir.js inherits the keyboard shortcuts and the screen layout from Mdir to maximize user-friendliness.

For bug reports, comments and questions, please email to la9527@daum.net

# Requirements

 - Node.js >= 10.x

# Tested OS

 - Windows 10
 - MAC OSX Catalina (10.15.x)
 - Ubuntu Linux

# License

 Mdir.js is distributed under the BSD 3-Clause License.
 See ['LICENSE'] for the detail.

# Installation

### 1. Install

```bash
$ npm install mdir.js -g
```

### 2. Run 

```bash
$ mdir
```

### Version History


- v0.8.x
    - Support the compressed files (zip, tar.gz, gz, bz2)
      (Supports copy, remove, rename, create directories of the selected files in the compressed file viewer.)
- v0.7.x
    - Support the simple editor in the window box. (auto detect text file encoding)
- v0.6.x 
    - Support korean text translation.
- v0.5.x 
    - Support the image text viewer. (png, jpeg, gif)
    - Support the true color image in the iTerm for MacOS only.
- v0.4.x 
    - Support the terminal(sub shell) in the window box.
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
