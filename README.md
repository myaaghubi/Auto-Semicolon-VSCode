# Auto Semicolon - VSCode
<img src="https://github.com/myaaghubi/Auto-Semicolon-VSCode/blob/main/icon.png?raw=true" alt="Icon Auto Semicolon VSCode" width="128">

[![release](https://img.shields.io/github/release/myaaghubi/Auto-Semicolon-VSCode.svg?style=for-the-badge&logo=github&logoColor=white&colorA=2b303b&colorB=00e8c6)](https://github.com/myaaghubi/Auto-Semicolon-VSCode/releases/latest)
[![rating](https://img.shields.io/visual-studio-marketplace/stars/myaaghubi.auto-semicolon-vscode?style=for-the-badge&logo=reverbnation&logoColor=white&colorA=2b303b&colorB=FFE66D)](https://marketplace.visualstudio.com/items?itemName=myaaghubi.auto-semicolon-vscode)

A useful tool to enhance coding with VSCode.

This extension assists by moving the cursor to the end of the line `and/or` putting the `;` at the end of the line.

All programming languages including both `Semicolon separated` and `Non-Semicolon separated` are supported.
It's **`auto`**, **`smart`**, **`handy`**, and **`customizable`**. 

I found nothing for `PHP` so made my shit, now it's the `best` for all languages.

You may interested in [🍔 donating](#-donate).

## Install/Use
1. Install it from [market place > auto semicolon](https://marketplace.visualstudio.com/items?itemName=myaaghubi.auto-semicolon-vscode)
2. Press `;` anywhere
Enjoy it

## Notes
- Customizable by settings.
- `Multiple cursors` has been supported.
- Excluding quotes `` "'` `` supported (check it in settings).
- The `for(...;...;)` statement supported (check it in settings).
- `PHP`, `javascript`, `typescript`, `c#`, `c/c++`, `java`, `perl`, `dart`, `swift`, **even** `python`, `go`, `bash`, `scala`, `kotlin`, `r` supported, feel free to add your programming language in the list!

## Shortcuts
- `;` > To have it auto
- `alt + ;` then `;` > To put `;` manual (not auto)

    Or use the command palette `ctrl+shift+p` > `Insert Manually`.
- `alt` + twice `;` > To ignore enclosing curly bracket pair `{..}` (force move to the end of the line)

    Or use `ctrl+shift+p` > `Insert Force To The End`.
    You can change this option from settings.

## Keybinding
You can customize key bindings, to do that
    - Open Command Palette (`ctrl+shift+p`)
    - Search for 'Open keyboard shortcuts' then 'Auto Semicolon` > `Change keybinding`
```json
This is the default:
[
    { "key": "alt+; ;", "command": "auto-semicolon-vscode.position-insert-semicolon", "when": "editorTextFocus" },
    { "key": "alt+; ;", "command": "auto-semicolon-vscode.position-insert-semicolon", "when": "editorTextFocus" },
    { "key": "alt+; alt+;", "command": "auto-semicolon-vscode.auto-insert-semicolon-fte", "when": "editorTextFocus" }
]
```

## Preview
![Shot Auto-Semicolon-VSCode](assets/auto-semicolon1.gif)

![Shot Auto-Semicolon-VSCode](assets/auto-semicolon2.gif)

![Shot Auto-Semicolon-VSCode](assets/auto-semicolon3.gif)

## 🍔 Donate
Pick one to donate ☕ 🍺 🍸 🍔

ETH: 0x0ADd51D6855d2DF11BB5F331A3fa345c67a863b2

![Ethereum](assets/ethereum.jpg?raw=true "Ethereum")