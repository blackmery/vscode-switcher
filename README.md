# Switcher

Switcher for Visual Studio Code.

# Configures

setting.json ( `Ctrl+shift+P, >User Settings` )
```
{
    "switcher.findAllFilesInRootDirectory": false,
    "switcher.findExtensionOrder": [
        "m",
        "mm",
        "cpp",
        "c",
        "h",
        "hpp",
        "inl",
        "js",
        "html",
        "css"
    ]
}
```

keybindings.json ( `Ctrl+shift+P, >Keyboard Shortcuts` )
```
{
    { "key": "alt+o", "command": "extension.switcher.run" }
}
```
